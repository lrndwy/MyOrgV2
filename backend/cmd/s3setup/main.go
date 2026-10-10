// Command s3setup menyiapkan bucket S3-compatible (RustFS/MinIO) untuk
// MyOrg: membuat bucket kalau belum ada, memasang bucket policy anonymous-read
// (gambar & unduhan dirender browser tanpa tanda tangan), lalu menaruh objek
// probe untuk membuktikan bacanya jalan.
//
// Aplikasi tidak pernah membuat bucket sendiri, jadi ini langkah sekali jalan
// tiap kali menambah deployment storage (termasuk RustFS lokal).
//
// Jalankan dari backend/ dengan env storage yang sama seperti aplikasi:
//
//	go run ./cmd/s3setup
//
// Env: GOKIL_STORAGE_ENDPOINT, GOKIL_STORAGE_BUCKET, GOKIL_STORAGE_REGION,
// GOKIL_STORAGE_ACCESS_KEY_ID, GOKIL_STORAGE_SECRET_ACCESS_KEY,
// GOKIL_STORAGE_USE_SSL, GOKIL_STORAGE_BASE_URL.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

func env(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

func main() {
	endpoint := strings.TrimRight(env("GOKIL_STORAGE_ENDPOINT", "http://127.0.0.1:9000"), "/")
	bucket := env("GOKIL_STORAGE_BUCKET", "myorg")
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	client := s3.New(s3.Options{
		Region:       env("GOKIL_STORAGE_REGION", "us-east-1"),
		BaseEndpoint: aws.String(endpoint),
		UsePathStyle: true,
		Credentials: credentials.NewStaticCredentialsProvider(
			os.Getenv("GOKIL_STORAGE_ACCESS_KEY_ID"),
			os.Getenv("GOKIL_STORAGE_SECRET_ACCESS_KEY"),
			"",
		),
	})

	if _, err := client.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: aws.String(bucket)}); err != nil {
		log.Printf("create bucket: %v (lanjut; mungkin sudah ada)", err)
	} else {
		log.Printf("bucket %s dibuat", bucket)
	}

	policy := map[string]any{
		"Version": "2012-10-17",
		"Statement": []map[string]any{{
			"Effect":    "Allow",
			"Principal": map[string]any{"AWS": []string{"*"}},
			"Action":    []string{"s3:GetObject"},
			"Resource":  []string{"arn:aws:s3:::" + bucket + "/*"},
		}},
	}
	raw, err := json.Marshal(policy)
	if err != nil {
		log.Fatal(err)
	}
	if _, err := client.PutBucketPolicy(ctx, &s3.PutBucketPolicyInput{
		Bucket: aws.String(bucket),
		Policy: aws.String(string(raw)),
	}); err != nil {
		log.Fatalf("pasang bucket policy: %v", err)
	}
	fmt.Println("policy anonymous-read (s3:GetObject) terpasang")

	// Probe: upload lalu baca TANPA tanda tangan. Ini yang menangkap bucket
	// privat, default encryption SSE tanpa KMS, dan base URL yang salah.
	key := "_s3setup_probe.txt"
	if _, err := client.PutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
		Body:   strings.NewReader("ok"),
	}); err != nil {
		log.Fatalf("upload probe: %v", err)
	}
	base := strings.TrimRight(env("GOKIL_STORAGE_BASE_URL", endpoint+"/"+bucket), "/")
	resp, err := http.Get(base + "/" + key)
	if err != nil {
		log.Fatalf("baca probe: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.Fatalf("baca probe anonim: %s — bucket belum bisa dibaca publik", resp.Status)
	}
	fmt.Println("probe anonim OK:", base+"/"+key)
	fmt.Println("setup selesai")
}
