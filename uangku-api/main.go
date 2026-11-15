package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

type Transaction struct {
	ID       string `json:"id"`
	Title    string `json:"title" binding:"required"`
	Amount   int64  `json:"amount" binding:"required,gt=0"`
	Type     string `json:"type" binding:"required"`
	Category string `json:"category" binding:"required"`
	Date     string `json:"date" binding:"required"`
}

func main() {
	_ = godotenv.Load()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL tidak ditemukan di .env")
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal("Gagal koneksi ke database:", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatal("Database tidak merespons:", err)
	}
	log.Println("Berhasil terhubung ke PostgreSQL Neon!")

	r := gin.Default()
	r.Use(cors.Default()) // Izinkan request dari Frontend React

	// 1. GET: Ambil semua transaksi terbaru
	r.GET("/api/transactions", func(c *gin.Context) {
		rows, err := db.Query("SELECT id, title, amount, type, category, date FROM transactions ORDER BY date DESC, created_at DESC")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		transactions := []Transaction{}
		for rows.Next() {
			var t Transaction
			if err := rows.Scan(&t.ID, &t.Title, &t.Amount, &t.Type, &t.Category, &t.Date); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			transactions = append(transactions, t)
		}
		c.JSON(http.StatusOK, transactions)
	})

	// 2. POST: Tambah transaksi baru & kembalikan UUID hasil generate DB
	r.POST("/api/transactions", func(c *gin.Context) {
		var input Transaction
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		query := `INSERT INTO transactions (title, amount, type, category, date) 
		          VALUES ($1, $2, $3, $4, $5) RETURNING id`
		err := db.QueryRow(query, input.Title, input.Amount, input.Type, input.Category, input.Date).Scan(&input.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, input)
	})

	// 3. DELETE: Hapus transaksi berdasarkan UUID
	r.DELETE("/api/transactions/:id", func(c *gin.Context) {
		id := c.Param("id")
		res, err := db.Exec("DELETE FROM transactions WHERE id = $1", id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		rowsAffected, _ := res.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Transaksi tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Berhasil dihapus"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	r.Run(":" + port)
}