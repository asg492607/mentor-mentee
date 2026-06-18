from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    FIREBASE_CREDENTIALS_PATH: str = 'serviceAccountKey.json'
    FIREBASE_CREDENTIALS_JSON: str = ''
    FIREBASE_PROJECT_ID: str = 'mentee-93ae9'
    CORS_ORIGINS: str = '*'
    ALLOW_ANONYMOUS_MEETINGS: bool = False
    SMTP_HOST: str = 'smtp.gmail.com'
    SMTP_PORT: int = 587
    SMTP_USER: str = ''
    SMTP_PASSWORD: str = ''

    class Config:
        env_file = ".env"

    @property
    def cors_origins_list(self) -> list[str]:
        origins = [origin.strip() for origin in self.CORS_ORIGINS.split(',') if origin.strip()]
        return origins or []

settings = Settings()
