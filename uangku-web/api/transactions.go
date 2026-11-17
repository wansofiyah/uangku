package handler

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	_ "github.com/lib/pq"
)

type Transaction struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Amount   int64  `json:"amount"`
	Type     string `json:"type"`
	Category string `json:"category"`
	Date     string `json:"date"`
}

func Handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// 1. Ambil & Verifikasi Token JWT dari Header Authorization
	authHeader := r.Header.Get("Authorization")
	sessionToken := strings.TrimPrefix(authHeader, "Bearer ")

	if sessionToken == "" {
		http.Error(w, `{"error":"Unauthorized: Missing token"}`, http.StatusUnauthorized)
		return
	}

	parsedToken, err := jwt.Parse(sessionToken, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return []byte(os.Getenv("JWT_SECRET")), nil
	})

	if err != nil || !parsedToken.Valid {
		http.Error(w, `{"error":"Unauthorized: Invalid token"}`, http.StatusUnauthorized)
		return
	}

	claims, ok := parsedToken.Claims.(jwt.MapClaims)
	userID, hasSub := claims["sub"].(string)
	if !ok || !hasSub || userID == "" {
		http.Error(w, `{"error":"Unauthorized: Invalid user claims"}`, http.StatusUnauthorized)
		return
	}

	// 2. Koneksi ke Database Neon PostgreSQL
	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer db.Close()

	// 3. Eksekusi Query SQL Khusus untuk userID Ini
	switch r.Method {
	case http.MethodGet:
		rows, err := db.Query(
			"SELECT id, title, amount, type, category, date FROM transactions WHERE user_id = $1 ORDER BY date DESC, created_at DESC",
			userID,
		)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		list := []Transaction{}
		for rows.Next() {
			var t Transaction
			_ = rows.Scan(&t.ID, &t.Title, &t.Amount, &t.Type, &t.Category, &t.Date)
			list = append(list, t)
		}
		json.NewEncoder(w).Encode(list)

	case http.MethodPost:
		var input Transaction
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		err := db.QueryRow(
			"INSERT INTO transactions (user_id, title, amount, type, category, date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
			userID, input.Title, input.Amount, input.Type, input.Category, input.Date,
		).Scan(&input.ID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(input)

	case http.MethodDelete:
		parts := strings.Split(r.URL.Path, "/")
		id := parts[len(parts)-1]
		_, err := db.Exec("DELETE FROM transactions WHERE id = $1 AND user_id = $2", id, userID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"message": "Deleted"})
	}
}package handler

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	_ "github.com/lib/pq"
)

type Transaction struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Amount   int64  `json:"amount"`
	Type     string `json:"type"`
	Category string `json:"category"`
	Date     string `json:"date"`
}

func Handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// 1. Ambil & Verifikasi Token JWT dari Header Authorization
	authHeader := r.Header.Get("Authorization")
	sessionToken := strings.TrimPrefix(authHeader, "Bearer ")

	if sessionToken == "" {
		http.Error(w, `{"error":"Unauthorized: Missing token"}`, http.StatusUnauthorized)
		return
	}

	parsedToken, err := jwt.Parse(sessionToken, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return []byte(os.Getenv("JWT_SECRET")), nil
	})

	if err != nil || !parsedToken.Valid {
		http.Error(w, `{"error":"Unauthorized: Invalid token"}`, http.StatusUnauthorized)
		return
	}

	claims, ok := parsedToken.Claims.(jwt.MapClaims)
	userID, hasSub := claims["sub"].(string)
	if !ok || !hasSub || userID == "" {
		http.Error(w, `{"error":"Unauthorized: Invalid user claims"}`, http.StatusUnauthorized)
		return
	}

	// 2. Koneksi ke Database Neon PostgreSQL
	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer db.Close()

	// 3. Eksekusi Query SQL Khusus untuk userID Ini
	switch r.Method {
	case http.MethodGet:
		rows, err := db.Query(
			"SELECT id, title, amount, type, category, date FROM transactions WHERE user_id = $1 ORDER BY date DESC, created_at DESC",
			userID,
		)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		list := []Transaction{}
		for rows.Next() {
			var t Transaction
			_ = rows.Scan(&t.ID, &t.Title, &t.Amount, &t.Type, &t.Category, &t.Date)
			list = append(list, t)
		}
		json.NewEncoder(w).Encode(list)

	case http.MethodPost:
		var input Transaction
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		err := db.QueryRow(
			"INSERT INTO transactions (user_id, title, amount, type, category, date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
			userID, input.Title, input.Amount, input.Type, input.Category, input.Date,
		).Scan(&input.ID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(input)

	case http.MethodDelete:
		parts := strings.Split(r.URL.Path, "/")
		id := parts[len(parts)-1]
		_, err := db.Exec("DELETE FROM transactions WHERE id = $1 AND user_id = $2", id, userID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"message": "Deleted"})
	}
}