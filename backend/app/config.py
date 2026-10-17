from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    FIREBASE_CREDENTIALS_PATH: str = 'serviceAccountKey.json'
    FIREBASE_CREDENTIALS_JSON: str = ''
    FIREBASE_PROJECT_ID: str = 'mentorv1-848ef'
    # Used only by the backend to exchange an email/password login for a
    # Firebase session. Never expose this value to the browser.
    FIREBASE_WEB_API_KEY: str = ''
    SESSION_COOKIE_NAME: str = 'lumina_session'
    SESSION_COOKIE_SECURE: bool = True
    LEGACY_SUPER_ADMIN_EMAIL: str = ''
    CORS_ORIGINS: str = 'https://mentormenteemitadt.netlify.app'
    SMTP_HOST: str = 'smtp.gmail.com'
    SMTP_PORT: int = 587
    SMTP_USER: str = ''
    SMTP_PASSWORD: str = ''

    # Google Drive Recording Storage Configuration
    GOOGLE_DRIVE_FOLDER_ID: str = ''
    GOOGLE_DRIVE_API_KEY: str = ''
    GOOGLE_SERVICE_ACCOUNT_JSON: str = ''
    GOOGLE_SERVICE_ACCOUNT_PATH: str = ''
    GROQ_API_KEY: str = ''
    GEMINI_API_KEY: str = ''

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def cors_origins_list(self) -> list[str]:
        origins = [origin.strip() for origin in self.CORS_ORIGINS.split(',') if origin.strip()]
        # A wildcard is not an allow-list. Fail closed until exact frontend origins are configured.
        if '*' in origins:
            return []
        return origins

settings = Settings()
