import Head from "next/head";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader } from "../components/loader";
import styles from "../styles/index.module.css";
import { useQRCode } from 'next-qrcode';


export default function Home() {
  const [presentation, setPresentation] = useState();
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState("");
  const [engagement, setUrl] = useState("");

  const { Canvas } = useQRCode();
  const timerRef = useRef(null);

  // Clear the timeout
  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  // Step 2, check the backed if we received a presentation
  const pollForPresentation = useCallback(async (verificationId) => {
    const startTime = Date.now();
    const timeout = 60000; // 60 seconds

    const poll = async () => {
      if (Date.now() - startTime > timeout) {
        setState("timeout");
        throw new Error("Polling timed out after 60 seconds");
      }

      try {
        const res = await fetch(`/api/verify/check`, {
          method: "post",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            verificationId,
          }),
        });
        const data = await res.json();

        // presentation is received and verified
        if (data.state === "honored") {
          return data;
        } else {
          console.log(data);
          // other states
          setState(data.state);

          // pause for a bit
          await new Promise((resolve) => {
            timerRef.current = setTimeout(resolve, 1000);
          });

          // then recheck
          return poll();
        }
      } catch (err) {
        console.log("Error during check:", err);
      }
    };

    return poll();
  }, []);

  const onClick = useCallback(async () => {
    reset();
    setLoading(true);
    try {
      // Step 1, start the presentation flow
      const res = await fetch(`/api/verify/start`);
      const { verificationId, engagement } = await res.json();

      setUrl(engagement);

      // Start polling for a result. This happens once the user
      // follows the engagement link and presents a credential from ID Wallet
      const { presentation } = await pollForPresentation(verificationId);
      presentation.verifiableCredential = presentation.verifiableCredential.map(parseJwt);
      setPresentation(presentation);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }, [pollForPresentation]);

  const reset = () => {
    setLoading(false);
    setPresentation();
    setUrl("");
  };

  const parseJwt = (token) => {
    if (!token) {
      return;
    }
    const base64engagement = token.split(".")[1];
    const base64 = base64engagement.replace("-", "+").replace("_", "/");
    return JSON.parse(window.atob(base64));
  };

  return (

    <div className={styles.container}>
      <Head>
        <title>Verifier App Demo</title>
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>Credential Verification</h1>
        <div className={styles.loaderContainer}>
          {loading ? null : (
              <button className={styles.button} onClick={onClick}>
                Start Presentation Flow
              </button>
          )}
        </div>
        {loading && !engagement && (
            <Loader/>
        )}
        {engagement && !presentation && loading && (
            <div style={{textAlign: 'center'}}>
              <p>Scan the QRCode</p>

              <div className={styles.qrCodeContainer}>
                <Canvas
                    text={engagement}
                    options={{
                      errorCorrectionLevel: 'M',
                      margin: 3,
                      scale: 4,
                      width: 200,
                      color: {
                        dark: '#010599FF',
                        light: '#FFFFFF',
                      },
                    }}
                />
              </div>
              <br/>
              OR
              <br/>
              <br/>
              Click{" "}
              <a href={engagement} target="_blank" rel="noreferrer">
                here
              </a>{" "}
              to open your wallet and present your credential
            </div>
        )}
        {engagement && !presentation ? (
            <p>
              State: <code>{state}</code>
            </p>
        ) : null}

        {presentation && (
            <div className={styles.presentation}>
              <pre className={styles.jwt}>{JSON.stringify(presentation, null, 4)} </pre>
            </div>
        )}
        {engagement && (
            <button className={styles.reset} onClick={reset}>
              Reset
            </button>
        )}
      </main>
    </div>
  );
}
