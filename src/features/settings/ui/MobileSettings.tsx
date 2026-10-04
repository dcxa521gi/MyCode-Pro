import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "../../../shared/i18n";
import { SettingsDropdown } from "../../../shared/ui/SettingsDropdown";
import { BusyIndicator } from "../../../shared/ui/BusyIndicator";

type Pairing = {
  mode?: "direct" | "relay";
  url: string;
  fingerprint?: string;
  transportKey?: string;
  room?: string;
  pairing: string;
  expiresIn: number;
  addresses?: { address: string; name: string }[];
};
type Connection = {
  enabled: boolean;
  devices: { id: string; name: string }[];
  pairing: Pairing | null;
  relayStatus: string;
};
const field =
  "mt-2 w-full rounded-lg border border-content/15 bg-content/5 p-3 text-xs outline-none";
const button =
  "rounded-lg border border-content/15 px-3 py-2 text-xs transition hover:bg-selection disabled:opacity-40";
export function MobileSettings() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false),
    [devices, setDevices] = useState<Connection["devices"]>([]),
    [pairing, setPairing] = useState<Pairing | null>(null),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [qr, setQr] = useState(""),
    [address, setAddress] = useState(""),
    [relayStatus, setRelayStatus] = useState("");
  const [mode, setMode] = useState(() =>
      localStorage.getItem("mycode.mobileMode") === "relay"
        ? "relay"
        : "direct",
    ),
    [relayUrl, setRelayUrl] = useState(
      () => localStorage.getItem("mycode.relayUrl") || "",
    ),
    [registrationKey, setRegistrationKey] = useState("");
  useEffect(() => {
    let live = true;
    const refresh = () =>
      void invoke<Connection>("mobile_status")
        .then((v) => {
          if (!live || !v) return;
          setEnabled(v.enabled);
          setDevices(v.devices || []);
          setPairing(v.pairing);
          setRelayStatus(v.relayStatus);
          if (v.pairing) setMode(v.pairing.mode || "direct");
        })
        .catch(() => {});
    refresh();
    const timer = setInterval(refresh, 3000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  const shared = pairing
    ? JSON.stringify({
        mode: pairing.mode || "direct",
        url: pairing.mode === "relay" ? pairing.url : address || pairing.url,
        ...(pairing.mode === "relay"
          ? { room: pairing.room, transportKey: pairing.transportKey }
          : { fingerprint: pairing.fingerprint }),
        pairing: pairing.pairing,
      })
    : "";
  useEffect(() => {
    let live = true;
    if (!shared || !pairing?.pairing || pairing.expiresIn === 0) {
      setQr("");
      return;
    }
    void import("qrcode")
      .then((q) =>
        q.toDataURL(shared, {
          width: 256,
          margin: 2,
          errorCorrectionLevel: "M",
        }),
      )
      .then((v) => {
        if (live) setQr(v);
      })
      .catch(() => {
        if (live)
          setStatus(t("Could not generate QR. Copy the pairing code instead."));
      });
    return () => {
      live = false;
    };
  }, [shared, !!pairing?.pairing, pairing?.expiresIn === 0, t]);
  const run = async () => {
    setBusy(true);
    setStatus("");
    try {
      if (enabled) {
        await invoke("mobile_stop");
        setEnabled(false);
        setPairing(null);
        setDevices([]);
        setAddress("");
      } else {
        localStorage.setItem("mycode.mobileMode", mode);
        localStorage.setItem("mycode.relayUrl", relayUrl.trim());
        const p = await invoke<Pairing>("mobile_start", {
          relayUrl: mode === "relay" ? relayUrl.trim() : null,
          registrationKey: mode === "relay" ? registrationKey : null,
        });
        setPairing(p);
        setAddress("");
        setEnabled(true);
        setRelayStatus(mode === "relay" ? "connected" : "");
      }
    } catch (e) {
      setStatus(t(String(e)));
    } finally {
      setBusy(false);
    }
  };
  const renew = async () => {
    setBusy(true);
    try {
      setPairing(await invoke<Pairing>("mobile_renew"));
      setStatus(t("New pairing code ready."));
    } catch (e) {
      setStatus(t(String(e)));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-content/10 bg-content/[0.035] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium">
              {t("Connect Android to this computer")}
            </h2>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-content/55">
              {t(
                "View and continue your computer sessions from Android. The computer runs your configured agents and models.",
              )}
            </p>
          </div>
          <button
            disabled={
              busy || (!enabled && mode === "relay" && !relayUrl.trim())
            }
            onClick={() => void run()}
            className={button}
          >
            {busy ? (
              <BusyIndicator label={t("Connecting…")} />
            ) : (
              t(enabled ? "Disconnect devices" : "Enable mobile connection")
            )}
          </button>
        </div>
        <div className="mt-5 max-w-xl">
          <label className="text-xs text-content/60">
            {t("Connection mode")}
          </label>
          <SettingsDropdown
            aria-label={t("Connection mode")}
            value={mode}
            disabled={enabled || busy}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="direct">{t("Direct connection")}</option>
            <option value="relay">{t("Remote relay")}</option>
          </SettingsDropdown>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-content/55">
          {t(
            mode === "relay"
              ? "Phone and computer can use different networks. Both connect to your HTTPS relay; session traffic is encrypted between the two devices."
              : "Choose a computer address reachable from your phone. A firewall must allow the displayed TCP port. Use remote relay when the networks cannot reach each other.",
          )}
        </p>
        {mode === "relay" && (
          <div className="mt-4 grid max-w-xl gap-3">
            <label className="text-xs text-content/60">
              {t("Remote relay address")}
              <input
                className={field}
                value={relayUrl}
                disabled={enabled || busy}
                onChange={(e) => setRelayUrl(e.target.value)}
                placeholder="https://relay.example.com"
                type="url"
              />
            </label>
            <label className="text-xs text-content/60">
              {t("Relay registration key")}
              <input
                className={field}
                value={registrationKey}
                disabled={enabled || busy}
                onChange={(e) => setRegistrationKey(e.target.value)}
                autoComplete="off"
                type="password"
                placeholder={t(
                  "Required only if your relay has a registration key",
                )}
              />
            </label>
            <p className="text-xs leading-relaxed text-content/45">
              {t(
                "Deploy the bundled MyCode relay on your server and enter its HTTPS address. The registration key is never included in the phone pairing code.",
              )}
            </p>
          </div>
        )}
        {enabled && mode === "relay" && (
          <p role="status" className="mt-3 text-xs text-content/60">
            {t(
              relayStatus === "connected"
                ? "Remote relay connected"
                : relayStatus === "expired"
                  ? "Remote connection expired. Disconnect and enable it again."
                  : "Reconnecting to remote relay…",
            )}
          </p>
        )}
      </div>
      {pairing && (
        <div className="grid gap-5 rounded-2xl border border-content/10 p-5 sm:grid-cols-[256px_1fr]">
          <div className="flex min-h-48 items-center justify-center rounded-xl bg-content/5">
            {qr ? (
              <img
                alt={t("Android pairing QR code")}
                src={qr}
                className="size-64 rounded-xl"
              />
            ) : (
              <p className="p-5 text-center text-xs text-content/50">
                {t(
                  "Pairing code used or expired. Refresh it to add another device.",
                )}
              </p>
            )}
          </div>
          <div className="min-w-0 space-y-3">
            <h3 className="text-sm font-medium">
              {t("Scan in the MyCode Android app")}
            </h3>
            <p className="text-xs leading-relaxed text-content/55">
              {t(
                "Pairing codes are private and valid for 10 minutes. Refreshing a code keeps existing devices connected; disconnecting revokes all devices.",
              )}
            </p>
            <p className="text-xs text-content/50">
              {t("Pairing time remaining")}: {Math.ceil(pairing.expiresIn / 60)}{" "}
              {t("minutes")}
            </p>
            {pairing.mode !== "relay" && !!pairing.addresses?.length && (
              <SettingsDropdown
                aria-label={t("Computer network address")}
                value={address || pairing.url}
                onChange={(e) => setAddress(e.target.value)}
              >
                {pairing.addresses.map((a) => {
                  const url = new URL(pairing.url);
                  url.hostname = a.address;
                  return (
                    <option key={a.address} value={url.toString()}>
                      {a.name} · {a.address}
                    </option>
                  );
                })}
              </SettingsDropdown>
            )}
            <label className="block text-xs text-content/55">
              {t("Computer address")}
              <input
                value={
                  pairing.mode === "relay"
                    ? pairing.url
                    : address || pairing.url
                }
                readOnly={pairing.mode === "relay"}
                onChange={(e) => setAddress(e.target.value)}
                className={field}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={!pairing.pairing || pairing.expiresIn === 0}
                onClick={() =>
                  void navigator.clipboard
                    .writeText(shared)
                    .then(() => setStatus(t("Pairing code copied.")))
                    .catch(() => setStatus(t("Could not copy pairing code.")))
                }
                className={button}
              >
                {t("Copy pairing code")}
              </button>
              <button
                disabled={busy}
                onClick={() => void renew()}
                className={button}
              >
                {t("Refresh pairing code")}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="rounded-xl border border-content/10 p-4">
        <h3 className="text-sm font-medium">{t("Paired devices")}</h3>
        {devices.length ? (
          devices.map((d) => (
            <div
              key={d.id}
              className="mt-3 flex items-center justify-between gap-4"
            >
              <span className="text-xs text-content/65">{d.name}</span>
              <button
                className={button}
                onClick={() =>
                  void invoke("mobile_revoke", { deviceId: d.id })
                    .then(() =>
                      setDevices((prev) => prev.filter((v) => v.id !== d.id)),
                    )
                    .catch((e) => setStatus(t(String(e))))
                }
              >
                {t("Revoke device")}
              </button>
            </div>
          ))
        ) : (
          <p className="mt-2 text-xs text-content/45">
            {t("No paired devices.")}
          </p>
        )}
      </div>
      {status && (
        <p
          role="status"
          className="break-words rounded-xl bg-content/5 p-3 text-xs text-content/65"
        >
          {status}
        </p>
      )}
    </section>
  );
}
