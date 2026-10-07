package storageutil

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"

	"github.com/lrndwy/gokil/config"
	"github.com/lrndwy/gokil/storage"
)

// s3Provider menggantikan storage.NewS3 milik gokil untuk provider "s3".
//
// Alasannya satu bug konkret: SDK menandatangani header Accept-Encoding
// (di-set middleware DisableGzip bawaan SDK menjadi "identity") sebelum
// request dikirim. Kalau S3-compatible server berada di balik reverse proxy
// yang menulis ulang Accept-Encoding — Cloudflare melakukannya — nilai header
// yang diterima server berbeda dari yang ikut ditandatangani, sehingga SigV4
// dihitung ulang server dan tidak pernah cocok:
//
//	403 SignatureDoesNotMatch: The request signature we calculated does not
//	match the signature you provided.
//
// Request yang sama berhasil kalau Accept-Encoding tidak ikut di-sign, jadi
// provider ini (1) membuang header itu sebelum signing, lalu (2) memasangnya
// kembali setelah request ditandatangani (tidak ter-sign, server mengabaikan
// header yang tidak ada di daftar SignedHeaders).
type s3Provider struct {
	client  *s3.Client
	bucket  string
	baseURL string
}

func newS3(settings config.StorageSettings) (storage.Provider, error) {
	if strings.TrimSpace(settings.Bucket) == "" {
		return nil, fmt.Errorf("S3 bucket is required")
	}

	opts := []func(*awsconfig.LoadOptions) error{}
	if settings.Region != "" {
		opts = append(opts, awsconfig.WithRegion(settings.Region))
	}
	if settings.AccessKeyID != "" && settings.SecretAccessKey != "" {
		opts = append(opts, awsconfig.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(settings.AccessKeyID, settings.SecretAccessKey, ""),
		))
	}

	cfg, err := awsconfig.LoadDefaultConfig(context.Background(), opts...)
	if err != nil {
		return nil, fmt.Errorf("load aws config: %w", err)
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		if settings.Endpoint != "" {
			// Trailing slash bikin endpoint jadi "//bucket/key".
			o.BaseEndpoint = aws.String(strings.TrimSuffix(settings.Endpoint, "/"))
			o.UsePathStyle = true
		}
		o.APIOptions = append(o.APIOptions, dropAcceptEncoding())
		o.HTTPClient = &identityEncodingClient{rt: http.DefaultTransport}
	})

	return &s3Provider{client: client, bucket: settings.Bucket, baseURL: settings.BaseURL}, nil
}

// dropAcceptEncoding dijalankan tepat sebelum middleware signing, setelah
// DisableGzip SDK men-set "Accept-Encoding: identity".
func dropAcceptEncoding() func(*middleware.Stack) error {
	return func(stack *middleware.Stack) error {
		return stack.Finalize.Insert(&dropAcceptEncodingMiddleware{}, "Signing", middleware.Before)
	}
}

type dropAcceptEncodingMiddleware struct{}

func (*dropAcceptEncodingMiddleware) ID() string { return "DropAcceptEncoding" }

func (*dropAcceptEncodingMiddleware) HandleFinalize(
	ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler,
) (middleware.FinalizeOutput, middleware.Metadata, error) {
	if req, ok := in.Request.(*smithyhttp.Request); ok {
		req.Header.Del("Accept-Encoding")
	}
	return next.HandleFinalize(ctx, in)
}

// identityEncodingClient memasang kembali Accept-Encoding setelah request
// ditandatangani, supaya net/http tidak menambahkan gzip otomatis.
type identityEncodingClient struct{ rt http.RoundTripper }

func (c *identityEncodingClient) Do(req *http.Request) (*http.Response, error) {
	req.Header.Set("Accept-Encoding", "identity")
	return c.rt.RoundTrip(req)
}

func (s *s3Provider) Upload(ctx context.Context, key string, reader io.Reader, size int64, contentType string) error {
	input := &s3.PutObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
		Body:   reader,
	}
	if contentType != "" {
		input.ContentType = aws.String(contentType)
	}
	if size > 0 {
		input.ContentLength = aws.Int64(size)
	}
	_, err := s.client.PutObject(ctx, input)
	return err
}

func (s *s3Provider) Download(ctx context.Context, key string) (io.ReadCloser, error) {
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, err
	}
	return out.Body, nil
}

func (s *s3Provider) Delete(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	return err
}

func (s *s3Provider) URL(key string) (string, error) {
	if s.baseURL != "" {
		return strings.TrimSuffix(s.baseURL, "/") + "/" + key, nil
	}
	return fmt.Sprintf("https://%s.s3.amazonaws.com/%s", s.bucket, key), nil
}
