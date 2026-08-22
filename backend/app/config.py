from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    app_name: str = "KhetOS API"
    environment: str = "development"
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://localhost:4173"
    mongo_url: str = "mongodb://localhost:27017"
    mongo_database: str = "gramin_connect"
    influx_url: str = "http://localhost:8086"
    influx_token: str = "gramin-connect-token"
    influx_org: str = "gramin-connect"
    influx_bucket: str = "telemetry"
    data_gov_api_key: str = "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b"
    data_gov_resource_id: str = "9ef84268-d588-465a-a308-a864a43d0070"
    imd_api_url: str = ""
    weather_forecast_api_url: str = "https://api.open-meteo.com/v1/forecast"
    whatsapp_api_url: str = ""
    whatsapp_access_token: str = ""
    whatsapp_phone_number_id: str = ""
    whatsapp_graph_version: str = "v23.0"
    whatsapp_template_name: str = ""
    whatsapp_template_language: str = "en"
    demo_mode: bool = False
    live_packet_ttl_seconds: int = 10
    auth_secret: str = "change-this-local-secret-before-cloud-deployment"
    auth_token_hours: int = 8
    device_ingest_key: str = ""
    data_dir: Path = BASE_DIR / "data"
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def origins(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


settings = Settings()
