import { useRef, useState } from "react";
import Webcam from "react-webcam";

interface Props {
  onCapture: (dataUrl: string) => void;
  onCancel: () => void;
}

const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: { ideal: "environment" }, // rear camera on phones
  width: { ideal: 1920 },
  height: { ideal: 1080 },
};

export function WebcamCapture({ onCapture, onCancel }: Props) {
  const webcamRef = useRef<Webcam>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capture = () => {
    const shot = webcamRef.current?.getScreenshot();
    if (shot) onCapture(shot);
    else setError("La capture a échoué, réessayez.");
  };

  return (
    <div className="webcam">
      {error ? (
        <p className="error" role="alert">{error}</p>
      ) : (
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          screenshotQuality={0.95}
          forceScreenshotSourceSize
          videoConstraints={VIDEO_CONSTRAINTS}
          onUserMedia={() => setReady(true)}
          onUserMediaError={() =>
            setError(
              "Impossible d'accéder à la caméra : autorisation refusée, aucune caméra, " +
                "ou page non servie en HTTPS / localhost.",
            )
          }
        />
      )}
      <div className="actions">
        <button type="button" onClick={capture} disabled={!ready || !!error}>
          Capturer
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </div>
  );
}
