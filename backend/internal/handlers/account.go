package handlers

import (
	"context"
	"net/http"

	v1 "github.com/epicchewy/endorphins/backend/internal/api/v1"
	"github.com/epicchewy/endorphins/backend/internal/domains"
	"github.com/labstack/echo/v5"
)

const userKey = "endorphins.user"

type accountService interface {
	Resolve(context.Context, string) (domains.User, error)
	Export(context.Context, string) (domains.AccountExport, error)
}
type Account struct{ service accountService }

func NewAccount(service accountService) *Account { return &Account{service: service} }
func (h *Account) Require(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c *echo.Context) error {
		c.Response().Header().Set("Cache-Control", "no-store")
		subject := domains.Subject(c.Request().Context())
		if subject == "" {
			return echo.NewHTTPError(http.StatusUnauthorized, "Sign in to access your workouts.")
		}
		user, err := h.service.Resolve(c.Request().Context(), subject)
		if err != nil {
			return err
		}
		c.Set(userKey, user)
		return next(c)
	}
}
func currentUser(c *echo.Context) domains.User { user, _ := c.Get(userKey).(domains.User); return user }
func (h *Account) Me(c *echo.Context) error {
	return c.JSON(http.StatusOK, v1.NewUserResponse(currentUser(c)))
}
func (h *Account) Export(c *echo.Context) error {
	data, err := h.service.Export(c.Request().Context(), currentUser(c).ID)
	if err != nil {
		return err
	}
	c.Response().Header().Set("Content-Disposition", `attachment; filename="endorphins-account.json"`)
	return c.JSON(http.StatusOK, v1.NewAccountExportResponse(data))
}
