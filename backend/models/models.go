package models

import (
	"encoding/json"
	"time"

	"github.com/lrndwy/gokil/orm"
)

func init() {
	_ = orm.RegisterModels(
		&OrganizationSettings{},
		&Role{},
		&Permission{},
		&RolePermission{},
		&Division{},
		&User{},
		&Event{},
		&Attendance{},
		&PermissionRequest{},
		&Violation{},
		&ViolationType{},
		&Recruitment{},
		&RecruitmentTargetDivision{},
		&RecruitmentCustomField{},
		&RecruitmentSubmission{},
		&LetterCategory{},
		&LetterTemplate{},
		&Letter{},
		&Announcement{},
		&AnnouncementAttachment{},
		&FinanceCategory{},
		&FinanceTransaction{},
		&PushSubscription{},
		&StorageFolder{},
		&StorageFile{},
		&ActivityLog{},
	)
}

type OrganizationSettings struct {
	orm.BaseModel
	WebName                      string `orm:"size:100" json:"web_name"`
	LogoURL                      string `orm:"size:255" json:"logo_url"`
	IconURL                      string `orm:"size:255" json:"icon_url"`
	Theme                        string `orm:"size:20;default:system" json:"theme"`
	AllowSelfRegister            bool   `orm:"default:false" json:"allow_self_register"`
	AllowCrossDivisionEventsView bool   `orm:"default:false" json:"allow_cross_division_events_view"`
}

type Role struct {
	orm.BaseModel
	Name        string `orm:"unique,required,size:50" json:"name"`
	Description string `orm:"text" json:"description"`
	IsSystem    bool   `orm:"default:false" json:"is_system"`
}

type Permission struct {
	orm.BaseModel
	Code        string `orm:"unique,required,size:100" json:"code"`
	Module      string `orm:"size:50" json:"module"`
	Description string `orm:"size:255" json:"description"`
}

type RolePermission struct {
	orm.BaseModel
	Role       orm.BelongsTo[Role]       `orm:"required" json:"-"`
	RoleID     int64                     `orm:"index" json:"role_id"`
	Permission orm.BelongsTo[Permission] `orm:"required" json:"-"`
	PermissionID int64                   `orm:"index" json:"permission_id"`
}

type Division struct {
	orm.BaseModel
	Name        string `orm:"required,size:100" json:"name"`
	Description string `orm:"text" json:"description"`
}

type User struct {
	orm.BaseModel
	Username     string            `orm:"unique,required,size:50" json:"username"`
	Email        string            `orm:"unique,required,size:100" json:"email"`
	PasswordHash string            `orm:"size:255" json:"-"`
	FullName     string            `orm:"size:150" json:"full_name"`
	BirthDate    *time.Time        `orm:"null" json:"birth_date,omitempty"`
	Hometown     string            `orm:"size:100" json:"hometown"`
	Phone        string            `orm:"size:20" json:"phone"`
	AvatarURL    string            `orm:"size:255" json:"avatar_url"`
	Division     orm.BelongsTo[Division] `json:"-"`
	DivisionID   int64             `orm:"index" json:"division_id"`
	Role         orm.BelongsTo[Role]     `json:"-"`
	RoleID       int64             `orm:"index" json:"role_id"`
	Status       string            `orm:"size:20;default:active" json:"status"`
}

type Event struct {
	orm.BaseModel
	Title            string              `orm:"required,size:150" json:"title"`
	Description      string              `orm:"text" json:"description"`
	Division         orm.BelongsTo[Division] `json:"-"`
	DivisionID       *int64              `orm:"null" json:"division_id"`
	Location         string              `orm:"size:255" json:"location"`
	BannerURL        string              `orm:"size:255" json:"banner_url"`
	StartTime        time.Time           `json:"start_time"`
	EndTime          time.Time           `json:"end_time"`
	AllowPermission  bool                `orm:"default:false" json:"allow_permission"`
	Status           string              `orm:"size:20;default:upcoming" json:"status"`
	CreatedBy        orm.BelongsTo[User] `json:"-"`
	CreatedByID      int64               `orm:"index" json:"created_by_id"`
}

type Attendance struct {
	orm.BaseModel
	Event         orm.BelongsTo[Event] `orm:"required" json:"-"`
	EventID       int64                `orm:"index" json:"event_id"`
	User          orm.BelongsTo[User]  `orm:"required" json:"-"`
	UserID        int64                `orm:"index" json:"user_id"`
	Status        string               `orm:"size:20;default:absent" json:"status"`
	SelfieURL     string               `orm:"size:255" json:"selfie_url"`
	SignatureURL  string               `orm:"size:255" json:"signature_url"`
	CheckedInAt   *time.Time           `orm:"null" json:"checked_in_at,omitempty"`
}

type PermissionRequest struct {
	orm.BaseModel
	Event       orm.BelongsTo[Event] `orm:"required" json:"-"`
	EventID     int64                `orm:"index" json:"event_id"`
	User        orm.BelongsTo[User]  `orm:"required" json:"-"`
	UserID      int64                `orm:"index" json:"user_id"`
	Reason      string               `orm:"text" json:"reason"`
	ProofURL    string               `orm:"size:255" json:"proof_url"`
	Status      string               `orm:"size:20;default:pending" json:"status"`
	ReviewedBy  orm.BelongsTo[User]  `json:"-"`
	ReviewedByID *int64              `orm:"null" json:"reviewed_by_id,omitempty"`
	ReviewNote  string               `orm:"text" json:"review_note"`
	ReviewedAt  *time.Time           `orm:"null" json:"reviewed_at,omitempty"`
}

type ViolationType struct {
	orm.BaseModel
	Name        string `orm:"size:100" json:"name"`
	Description string `orm:"text" json:"description"`
	SPLevel     string `orm:"size:20" json:"sp_level"`
}

type Violation struct {
	orm.BaseModel
	User          orm.BelongsTo[User] `orm:"required" json:"-"`
	UserID        int64               `orm:"index" json:"user_id"`
	ViolationType string              `orm:"size:100" json:"violation_type"`
	Description   string              `orm:"text" json:"description"`
	SPLevel       string              `orm:"size:20" json:"sp_level"`
	DocumentURL   string              `orm:"size:255" json:"document_url"`
	IssuedBy      orm.BelongsTo[User] `orm:"required" json:"-"`
	IssuedByID    int64               `orm:"index" json:"issued_by_id"`
	IssuedDate    time.Time           `json:"issued_date"`
}

type Recruitment struct {
	orm.BaseModel
	Title       string              `orm:"required,size:150" json:"title"`
	Description string              `orm:"text" json:"description"`
	Slug        string              `orm:"unique,required,size:100" json:"slug"`
	OpenDate    time.Time           `json:"open_date"`
	CloseDate   time.Time           `json:"close_date"`
	Status      string              `orm:"size:20;default:draft" json:"status"`
	CreatedBy   orm.BelongsTo[User] `json:"-"`
	CreatedByID int64               `orm:"index" json:"created_by_id"`
}

type RecruitmentTargetDivision struct {
	orm.BaseModel
	Recruitment   orm.BelongsTo[Recruitment] `orm:"required" json:"-"`
	RecruitmentID int64                      `orm:"index" json:"recruitment_id"`
	Division      orm.BelongsTo[Division]    `orm:"required" json:"-"`
	DivisionID    int64                      `orm:"index" json:"division_id"`
}

type RecruitmentCustomField struct {
	orm.BaseModel
	Recruitment   orm.BelongsTo[Recruitment] `orm:"required" json:"-"`
	RecruitmentID int64                      `orm:"index" json:"recruitment_id"`
	FieldLabel    string                     `orm:"size:100" json:"field_label"`
	FieldType     string                     `orm:"size:20" json:"field_type"`
	FieldOptions  json.RawMessage            `orm:"type:json" json:"field_options,omitempty"`
	IsRequired    bool                       `orm:"default:true" json:"is_required"`
	OrderIndex    int                        `json:"order_index"`
}

type RecruitmentSubmission struct {
	orm.BaseModel
	Recruitment      orm.BelongsTo[Recruitment] `orm:"required" json:"-"`
	RecruitmentID    int64                      `orm:"index" json:"recruitment_id"`
	Name             string                     `orm:"size:150" json:"name"`
	NIM              string                     `orm:"size:50" json:"nim"`
	DivisionInterest orm.BelongsTo[Division]    `json:"-"`
	DivisionInterestID int64                    `orm:"index" json:"division_interest_id"`
	Contact          string                     `orm:"size:100" json:"contact"`
	CustomAnswers    json.RawMessage            `orm:"type:json" json:"custom_answers,omitempty"`
	Status           string                     `orm:"size:20;default:submitted" json:"status"`
	SubmittedAt      time.Time                  `json:"submitted_at"`
}

type LetterCategory struct {
	orm.BaseModel
	Name                 string `orm:"size:100" json:"name"`
	Code                 string `orm:"size:20" json:"code"`
	StartNumber          int    `orm:"default:1" json:"start_number"`
	CurrentNumber        int    `orm:"default:0" json:"current_number"`
	NumberFormatTemplate string `orm:"size:100" json:"number_format_template"`
}

type LetterTemplate struct {
	orm.BaseModel
	Category     orm.BelongsTo[LetterCategory] `orm:"required" json:"-"`
	CategoryID   int64                         `orm:"index" json:"category_id"`
	Name         string                        `orm:"size:100" json:"name"`
	TemplateURL  string                        `orm:"size:255" json:"template_url"`
}

type Letter struct {
	orm.BaseModel
	Type           string                      `orm:"size:20" json:"type"`
	Category       orm.BelongsTo[LetterCategory] `orm:"required" json:"-"`
	CategoryID     int64                       `orm:"index" json:"category_id"`
	LetterCode     string                      `orm:"size:100" json:"letter_code"`
	Subject        string                      `orm:"size:255" json:"subject"`
	LetterDate     time.Time                   `json:"letter_date"`
	Sender         string                      `orm:"size:150" json:"sender"`
	Recipient      string                      `orm:"size:150" json:"recipient"`
	Description    string                      `orm:"text" json:"description"`
	AttachmentURL  string                      `orm:"size:255" json:"attachment_url"`
	DocumentURL    string                      `orm:"size:255" json:"document_url"`
	VariableValues JSONField                   `orm:"type:json;null" json:"variable_values,omitempty"`
	CreatedBy      orm.BelongsTo[User]         `json:"-"`
	CreatedByID    int64                       `orm:"index" json:"created_by_id"`
}

type Announcement struct {
	orm.BaseModel
	Title              string              `orm:"size:200" json:"title"`
	Content            string              `orm:"text" json:"content"`
	BannerURL          string              `orm:"size:255" json:"banner_url"`
	TargetType         string              `orm:"size:20" json:"target_type"`
	TargetDivision     orm.BelongsTo[Division] `json:"-"`
	TargetDivisionID   *int64              `orm:"null" json:"target_division_id"`
	PublishDate        time.Time           `json:"publish_date"`
	CreatedBy          orm.BelongsTo[User] `json:"-"`
	CreatedByID        int64               `orm:"index" json:"created_by_id"`
}

type AnnouncementAttachment struct {
	orm.BaseModel
	Announcement   orm.BelongsTo[Announcement] `orm:"required" json:"-"`
	AnnouncementID int64                       `orm:"index" json:"announcement_id"`
	FileURL        string                      `orm:"size:255" json:"file_url"`
	FileType       string                      `orm:"size:100" json:"file_type"`
}

type FinanceCategory struct {
	orm.BaseModel
	Name        string `orm:"size:100" json:"name"`
	Type        string `orm:"size:20" json:"type"`
	Description string `orm:"text" json:"description"`
}

type FinanceTransaction struct {
	orm.BaseModel
	Category        orm.BelongsTo[FinanceCategory] `orm:"required" json:"-"`
	CategoryID      int64                          `orm:"index" json:"category_id"`
	Type            string                         `orm:"size:20" json:"type"`
	Amount          float64                        `json:"amount"`
	Description     string                         `orm:"text" json:"description"`
	ReceiptURL      string                         `orm:"size:255" json:"receipt_url"`
	TransactionDate time.Time                      `json:"transaction_date"`
	CreatedBy       orm.BelongsTo[User]            `json:"-"`
	CreatedByID     int64                          `orm:"index" json:"created_by_id"`
}

type PushSubscription struct {
	orm.BaseModel
	User      orm.BelongsTo[User] `orm:"required" json:"-"`
	UserID    int64               `orm:"index" json:"user_id"`
	Endpoint  string              `orm:"unique,required,size:512" json:"endpoint"`
	P256dh    string              `orm:"size:255" json:"p256dh"`
	Auth      string              `orm:"size:255" json:"auth"`
}

type StorageFolder struct {
	orm.BaseModel
	Name     string `orm:"size:100" json:"name"`
	ParentID *int64 `orm:"null" json:"parent_id"`
}

type StorageFile struct {
	orm.BaseModel
	FolderID    *int64              `orm:"null" json:"folder_id"`
	Name        string              `orm:"size:255" json:"name"`
	FileURL     string              `orm:"size:512" json:"file_url"`
	MimeType    string              `orm:"size:100" json:"mime_type"`
	SizeBytes   int64               `json:"size_bytes"`
	CreatedBy   orm.BelongsTo[User] `json:"-"`
	CreatedByID int64               `orm:"index" json:"created_by_id"`
}

type ActivityLog struct {
	orm.BaseModel
	UserID       int64  `orm:"index" json:"user_id"`
	Action       string `orm:"size:50" json:"action"`
	ResourceType string `orm:"size:50" json:"resource_type"`
	ResourceID   int64  `json:"resource_id"`
	Description  string `orm:"text" json:"description"`
	IPAddress    string `orm:"size:45" json:"ip_address"`
}
