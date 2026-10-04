package workout

import (
	"context"

	"github.com/epicchewy/endorphins/backend/internal/domains"
)

type Catalogue interface {
	ForLevel(context.Context, int) (domains.Catalogue, error)
}
