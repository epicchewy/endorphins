package v1

type UpdateAccountRequest struct {
	DefaultLevel       int  `json:"defaultLevel"`
	CompleteOnboarding bool `json:"completeOnboarding"`
}
