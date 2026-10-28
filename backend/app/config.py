from urllib.parse import urlparse

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    FIREBASE_CREDENTIALS_PATH: str = 'serviceAccountKey.json'
    FIREBASE_CREDENTIALS_JSON: str = ''
    FIREBASE_PROJECT_ID: str = ''
    # Set this in the backend environment. Never ship the Identity Toolkit key
    # as a backend source-code default.
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
        origins = []
        for configured_origin in self.CORS_ORIGINS.split(','):
            origin = configured_origin.strip().rstrip('/')
            if not origin:
                continue
            parsed = urlparse(origin)
            try:
                parsed.port
            except ValueError as error:
                raise ValueError('CORS_ORIGINS contains an invalid port') from error
            if (
                origin == '*'
                or parsed.scheme not in {'http', 'https'}
                or not parsed.netloc
                or parsed.path
                or parsed.params
                or parsed.query
                or parsed.fragment
                or parsed.username
                or parsed.password
            ):
                raise ValueError('CORS_ORIGINS must contain exact HTTP(S) origins; wildcards and paths are not allowed')
            normalized = f'{parsed.scheme.lower()}://{parsed.netloc.lower()}'
            if normalized not in origins:
                origins.append(normalized)
        if not origins:
            raise ValueError('CORS_ORIGINS must contain at least one allowed origin')
        return origins

settings = Settings()
