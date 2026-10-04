// Package workout owns workout generation. It has no HTTP or storage dependencies.
package workout

type Service struct{ catalogue Catalogue }

func New(catalogue Catalogue) *Service { return &Service{catalogue: catalogue} }
