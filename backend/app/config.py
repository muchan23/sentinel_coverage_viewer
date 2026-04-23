from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    CDSE_SEARCH_URL: str = "https://stac.dataspace.copernicus.eu/v1/search"
    CDSE_TOKEN_URL: str = (
        "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
    )
    CDSE_CLIENT_ID: str = "cdse-public"
    CDSE_USERNAME: str = ""
    CDSE_PASSWORD: str = ""

    # カンマ区切りで許可するフロントエンドのオリジン
    ALLOWED_ORIGINS: str = "http://localhost:13100,http://127.0.0.1:13100"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]


settings = Settings()
