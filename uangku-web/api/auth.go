package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

type AuthRequest struct {
	Action   string `json:"action"` // "register" atau "login"
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  struct {
		ID    string `json:"id"`
		Name  string `json:"name"`
		Email string `json:"email"`
	} `json:"user"`
}

func AuthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req AuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Format data tidak valid"}`, http.StatusBadRequest)
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if req.Email == "" || len(req.Password) < 6 {
		http.Error(w, `{"error":"Email wajib diisi dan password minimal 6 karakter"}`, http.StatusBadRequest)
		return
	}

	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		http.Error(w, `{"error":"Gagal koneksi database"}`, http.StatusInternalServerError)
		return
	}
	defer db.Close()

	var userID, userName, passwordHash string

	if req.Action == "register" {
		if strings.TrimSpace(req.Name) == "" {
			http.Error(w, `{"error":"Nama lengkap wajib diisi"}`, http.StatusBadRequest)
			return
		}

		hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			http.Error(w, `{"error":"Gagal mengenkripsi password"}`, http.StatusInternalServerError)
			return
		}

		err = db.QueryRow(
			"INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name",
			strings.TrimSpace(req.Name), req.Email, string(hashed),
		).Scan(&userID, &userName)

		if err != nil {
			if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
				http.Error(w, `{"error":"Email sudah terdaftar, silakan login"}`, http.StatusConflict)
				return
			}
			http.Error(w, `{"error":"Gagal mendaftarkan akun"}`, http.StatusInternalServerError)
			return
		}
	} else {
		// Proses Login
		err = db.QueryRow(
			"SELECT id, name, password_hash FROM users WHERE email = $1",
			req.Email,
		).Scan(&userID, &userName, &passwordHash)

		if err != nil {
			http.Error(w, `{"error":"Email atau password salah"}`, http.StatusUnauthorized)
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
			http.Error(w, `{"error":"Email atau password salah"}`, http.StatusUnauthorized)
			return
		}
	}

	// Buat JWT Token yang berlaku selama 7 hari
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": userID,
		"exp": time.Now().Add(7 * 24 * time.Hour).Unix(),
	})

	tokenString, err := token.SignedString([]byte(os.Getenv("JWT_SECRET")))
	if err != nil {
		http.Error(w, `{"error":"Gagal membuat token sesi"}`, http.StatusInternalServerError)
		return
	}

	var resp AuthResponse
	resp.Token = tokenString
	resp.User.ID = userID
	resp.User.Name = userName
	resp.User.Email = req.Email

	json.NewEncoder(w).Encode(resp)
}