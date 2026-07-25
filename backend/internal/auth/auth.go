package auth

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"backend/models"

	"github.com/golang-jwt/jwt/v5"
	"github.com/lrndwy/gokil/orm"
	"github.com/lrndwy/gokil/views"
	"golang.org/x/crypto/bcrypt"
)

type ctxKey struct{}

type User struct {
	ID            int64
	RoleID        int64
	IsSystemAdmin bool
}

var ErrUnauthorized = errors.New("unauthorized")

func JWTSecret() string {
	if s := os.Getenv("JWT_SECRET"); s != "" {
		return s
	}
	return "dev-secret-change-me"
}

func HashPassword(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func CheckPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func IssueToken(userID int64) (string, error) {
	claims := jwt.MapClaims{
		"sub": strconv.FormatInt(userID, 10),
		"exp": time.Now().Add(7 * 24 * time.Hour).Unix(),
		"iat": time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(JWTSecret()))
}

func ParseToken(tokenStr string) (int64, error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return []byte(JWTSecret()), nil
	})
	if err != nil || !token.Valid {
		return 0, ErrUnauthorized
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return 0, ErrUnauthorized
	}
	sub, _ := claims["sub"].(string)
	return strconv.ParseInt(sub, 10, 64)
}

func tokenFromRequest(ctx *views.Context) string {
	if c, err := ctx.Request.Cookie("token"); err == nil && c.Value != "" {
		return c.Value
	}
	auth := ctx.Request.Header.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}
	return ""
}

func loadUser(ctx context.Context, userID int64) (*User, error) {
	u, err := orm.GetByID[models.User](ctx, userID)
	if err != nil {
		return nil, err
	}
	if u.Status == "deleted" || u.Status == "inactive" {
		return nil, ErrUnauthorized
	}
	role, err := orm.GetByID[models.Role](ctx, u.RoleID)
	if err != nil {
		return nil, err
	}
	return &User{ID: u.ID, RoleID: u.RoleID, IsSystemAdmin: role.IsSystem}, nil
}

func attachUser(ctx *views.Context) (*User, error) {
	token := tokenFromRequest(ctx)
	if token == "" {
		return nil, ErrUnauthorized
	}
	userID, err := ParseToken(token)
	if err != nil {
		return nil, err
	}
	user, err := loadUser(ctx.Request.Context(), userID)
	if err != nil {
		return nil, err
	}
	reqCtx := context.WithValue(ctx.Request.Context(), ctxKey{}, user)
	ctx.Request = ctx.Request.WithContext(reqCtx)
	return user, nil
}

func CurrentUser(ctx context.Context) (*User, bool) {
	u, ok := ctx.Value(ctxKey{}).(*User)
	return u, ok
}

func MustUser(ctx *views.Context) (*User, error) {
	if u, ok := CurrentUser(ctx.Request.Context()); ok {
		return u, nil
	}
	return attachUser(ctx)
}

func SetTokenCookie(ctx *views.Context, token string) {
	secure := os.Getenv("GOKIL_ENV") == "production"
	http.SetCookie(ctx.Writer, &http.Cookie{
		Name:     "token",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   secure,
		MaxAge:   7 * 24 * 3600,
	})
}

func ClearTokenCookie(ctx *views.Context) {
	http.SetCookie(ctx.Writer, &http.Cookie{
		Name:     "token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})
}

func RequireAuth(next views.Handler) views.Handler {
	return func(ctx *views.Context) error {
		if _, err := attachUser(ctx); err != nil {
			return ctx.Error(http.StatusUnauthorized, "unauthorized")
		}
		return next(ctx)
	}
}

func OptionalAuth(next views.Handler) views.Handler {
	return func(ctx *views.Context) error {
		_, _ = attachUser(ctx)
		return next(ctx)
	}
}
