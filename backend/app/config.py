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
        default_origins = [
            'https://mentormenteemitadt.netlify.app',
            'http://localhost:5000',
            'http://127.0.0.1:5000',
            'http://localhost:5500',
            'http://127.0.0.1:5500',
            'http://localhost:3000',
            'http://127.0.0.1:3000',
        ]
        configured = [
            origin.strip().rstrip('/')
            for origin in self.CORS_ORIGINS.split(',')
            if origin.strip() and origin.strip() != '*'
        ]
        seen = set()
        result = []
        for origin in configured + default_origins:
            if origin and origin not in seen:
                seen.add(origin)
                result.append(origin)
        return result

settings = Settings()
