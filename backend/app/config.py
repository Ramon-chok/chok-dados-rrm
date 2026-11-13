import logging
import secrets
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
    # Sem valor padrão no código: um segredo público permitiria forjar qualquer
    # sessão. Vazio => em desenvolvimento gera-se um segredo aleatório por
    # processo (get_settings); em produção a subida é recusada.
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 12
    # Origens explícitas (separadas por vírgula). "*" só é aceito fora de produção.
    cors_origins: str = "http://localhost:3000,http://localhost:5173"
    # "production" liga as verificações de startup (segredo, CORS, cookie Secure).
    environment: str = "development"
    # Confiar no X-Forwarded-For (só habilite atrás de proxy/CDN que o sobrescreve).
    trust_proxy: bool = False
    # Limites anti-DoS
    max_body_bytes: int = 1 * 1024 * 1024
    max_import_body_bytes: int = 30 * 1024 * 1024
    max_avatar_bytes: int = 2 * 1024 * 1024
    rate_limit_per_minute: int = 600
    rate_limit_auth_per_minute: int = 10
    rate_limit_import_per_minute: int = 60
    # Bloqueio de força bruta por conta
    login_max_failures: int = 5
    login_lock_seconds: int = 15 * 60
    server_host: str = "0.0.0.0"
    server_port: int = 8787
    # --- Fonte externa de dados (Quadro de Vendas / Categorias) ---------------
    # Enquanto estiver vazio, os quadros leem as tabelas locais já importadas.
    # Ao apontar para a API do ERP/BI, app/providers.py passa a buscar lá e as
    # metas importadas pelo ADMIN continuam servindo de comparativo.
    external_api_base_url: str = ""
    external_api_key: str = ""
    external_api_timeout_seconds: float = 20.0
    # SMTP / email settings
    smtp_host: str = ""
    smtp_port: int = 465
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_secure: bool = True
    smtp_from: str | None = None
    # Para onde vai o aviso de "Reportar bug". Vazio = o relato só fica
    # gravado no banco (tabela relatos_bug), sem e-mail.
    suporte_email: str = ""
    # JWT cookie settings (for HttpOnly auth cookie)
    jwt_cookie_name: str = "chok_auth_token"
    jwt_cookie_secure: bool = True
    jwt_cookie_http_only: bool = True
    # Em produção recomenda-se 'Lax' para compatibilidade com links externos,
    # ou 'Strict' para maior segurança. Use 'None' apenas com Secure e HTTPS.
    jwt_cookie_same_site: str = "Lax"  # Strict | Lax | None
    jwt_cookie_path: str = "/"
    jwt_cookie_domain: str | None = None


_INSECURE_SECRETS = {"", "dev-only-change-me", "troque-em-producao", "changeme", "secret"}


def _validate_for_production(s: Settings) -> None:
    problems: list[str] = []
    if s.jwt_secret in _INSECURE_SECRETS or len(s.jwt_secret) < 32:
        problems.append("JWT_SECRET ausente/fraco (mínimo 32 caracteres aleatórios)")
    if "*" in [o.strip() for o in s.cors_origins.split(",")]:
        problems.append('CORS_ORIGINS não pode ser "*" — liste as origens do frontend')
    if not s.jwt_cookie_secure:
        problems.append("JWT_COOKIE_SECURE deve ser true (HTTPS)")
    if not s.jwt_cookie_http_only:
        problems.append("JWT_COOKIE_HTTP_ONLY deve ser true")
    if s.jwt_cookie_same_site.lower() == "none":
        problems.append('JWT_COOKIE_SAME_SITE="None" desabilita a proteção CSRF do cookie')
    if problems:
        raise RuntimeError("Configuração insegura para produção: " + "; ".join(problems))


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.environment.lower() == "production":
        _validate_for_production(settings)
    elif settings.jwt_secret in _INSECURE_SECRETS or len(settings.jwt_secret) < 32:
        # Desenvolvimento sem segredo forte: efêmero e imprevisível. As sessões
        # caem a cada reinício do servidor, o que é o comportamento desejado.
        settings.jwt_secret = secrets.token_urlsafe(48)
        logging.getLogger(__name__).warning(
            "JWT_SECRET ausente/fraco: usando segredo temporário (sessões caem ao reiniciar)."
        )
    return settings
