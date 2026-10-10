package handlers

import (
	"encoding/json"
	"errors"
	"github.com/labstack/echo/v5"
	"io"
	"mime"
	"net/http"
)

func decodeJSON(c *echo.Context, input any) error {
	mediaType, _, err := mime.ParseMediaType(c.Request().Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		return echo.NewHTTPError(http.StatusUnsupportedMediaType, "Send this request as JSON.")
	}
	c.Request().Body = http.MaxBytesReader(c.Response(), c.Request().Body, 8192)
	decoder := json.NewDecoder(c.Request().Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(input); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Send a valid request.")
	}
	if err := decoder.Decode(new(any)); !errors.Is(err, io.EOF) {
		return echo.NewHTTPError(http.StatusBadRequest, "Send one request at a time.")
	}
	return nil
}
