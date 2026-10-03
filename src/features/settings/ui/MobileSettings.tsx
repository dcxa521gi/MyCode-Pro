import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "../../../shared/i18n";
type Pairing = {
  url: string;
  fingerprint: string;
  pairing: string;
  expiresIn: number;
};
export function MobileSettings() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false),
    [devices, setDevices] = useState<string[]>([]),
    [pairing, setPairing] = useState<Pairing | null>(null),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [qr, setQr] = useState("");
  useEffect(() => {
    const refresh = () =>
      void invoke<{ enabled: boolean; devices: string[] }>("mobile_status")
        .then((v) => {
          setEnabled(v.enabled);
          setDevices(v.devices);
        })
        .catch(() => {});
    refresh();
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let live = true;
    if (!pairing) {
      setQr("");
      return;
    }
    void import("qrcode")
      .then((q) =>
        q.toDataURL(JSON.stringify(pairing), {
          width: 256,
          margin: 2,
          errorCorrectionLevel: "M",
        }),
      )
      .then((value) => {
        if (live) setQr(value);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [pairing]);
  const run = async () => {
    setBusy(true);
    setStatus("");
    try {
      if (enabled) {
        await invoke("mobile_stop");
        setEnabled(false);
        setPairing(null);
      } else {
        const p = await invoke<Pairing>("mobile_start");
        setPairing(p);
        setEnabled(true);
      }
    } catch {
      setStatus(t("Could not start mobile connection."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-content/10 bg-content/[0.035] p-5">
        <div className="flex items-start justify-between gap-4">
          <span>
            <h2 className="text-sm font-medium">
              {t("Connect Android to this computer")}
            </h2>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-content/55">
              {t(
                "Pair on a trusted local network. CLI tasks run on this computer. Mobile connections use TLS and a pinned certificate. Keep MyCode running.",
              )}
            </p>
          </span>
          <button
            disabled={busy}
            onClick={() => void run()}
            className="shrink-0 rounded-lg border border-content/15 px-4 py-2 text-xs hover:bg-selection disabled:opacity-40"
          >
            {t(enabled ? "Disconnect devices" : "Enable mobile connection")}
          </button>
        </div>
      </div>
      {pairing && (
        <div className="grid gap-5 rounded-2xl border border-content/10 p-5 sm:grid-cols-[256px_1fr]">
          {qr && (
            <img
              alt={t("Android pairing QR code")}
              src={qr}
              className="size-64 rounded-xl"
            />
          )}
          <div className="min-w-0 space-y-3">
            <h3 className="text-sm font-medium">
              {t("Scan in the MyCode Android app")}
            </h3>
            <p className="text-xs leading-relaxed text-content/55">
              {t(
                "This pairing code is private, single-use and expires in 10 minutes. Disconnecting revokes all devices. Pair again after restarting MyCode.",
              )}
            </p>
            <label className="block text-xs text-content/55">
              {t("Computer address")}
              <input
                value={pairing.url}
                onChange={(e) =>
                  setPairing({ ...pairing, url: e.target.value })
                }
                className="mt-2 w-full rounded-lg border border-content/10 bg-content/5 p-2 text-xs outline-none"
              />
            </label>
            <p className="break-all font-mono text-[10px] text-content/40">
              {pairing.fingerprint}
            </p>
            <button
              onClick={() =>
                void navigator.clipboard
                  .writeText(JSON.stringify(pairing))
                  .then(() => setStatus(t("Pairing code copied.")))
                  .catch(() => setStatus(t("Could not copy pairing code.")))
              }
              className="rounded-lg border border-content/10 px-3 py-2 text-xs hover:bg-content/5"
            >
              {t("Copy pairing code")}
            </button>
          </div>
        </div>
      )}
      <div className="rounded-xl bg-content/[0.035] p-4">
        <h3 className="text-sm font-medium">{t("Paired devices")}</h3>
        {devices.length ? (
          devices.map((name, index) => (
            <p key={index} className="mt-2 text-xs text-content/60">
              {name}
            </p>
          ))
        ) : (
          <p className="mt-2 text-xs text-content/45">
            {t("No paired devices.")}
          </p>
        )}
      </div>
      {status && (
        <p role="status" className="text-xs text-content/60">
          {status}
        </p>
      )}
    </section>
  );
}
