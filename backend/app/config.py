from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = ""
    import_api_key: str = ""
    jwt_secret: str = "dev-only-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 12
    cors_origins: str = "*"
    seed_password: str = "Chok@2026"
    server_host: str = "0.0.0.0"
    server_port: int = 8787
    # SMTP / email settings
    smtp_host: str = ""
    smtp_port: int = 465
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_secure: bool = True
    smtp_from: str | None = None
    # JWT cookie settings (for HttpOnly auth cookie)
    jwt_cookie_name: str = "chok_auth_token"
    jwt_cookie_secure: bool = True
    jwt_cookie_http_only: bool = True
    # Em produção recomenda-se 'Lax' para compatibilidade com links externos,
    # ou 'Strict' para maior segurança. Use 'None' apenas com Secure e HTTPS.
    jwt_cookie_same_site: str = "Lax"  # Strict | Lax | None
    jwt_cookie_path: str = "/"
    jwt_cookie_domain: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
