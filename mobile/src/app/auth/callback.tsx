import { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { client } from "../../lib/client";
import { Button, Screen, styles } from "../../components/ui";
export default function Callback() {
  const params = useLocalSearchParams<{ code?: string; type?: string }>(),
    called = useRef(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (called.current) return;
    called.current = true;
    void (async () => {
      if (typeof params.code !== "string") {
        setError("확인 링크가 올바르지 않습니다. 다시 로그인해 주세요.");
        return;
      }
      const { error } = await client.auth.exchangeCodeForSession(params.code);
      if (error) {
        setError(
          "링크가 만료됐거나 요청한 휴대폰과 다릅니다. 다시 시도해 주세요.",
        );
        return;
      }
      router.replace(params.type === "recovery" ? "/auth/reset" : "/");
    })();
  }, [params.code, params.type]);
  return (
    <Screen title="이메일 확인">
      {error ? (
        <>
          <Text style={styles.error}>{error}</Text>
          <Button title="로그인으로" onPress={() => router.replace("/auth")} />
        </>
      ) : (
        <Text style={styles.text}>확인하고 있습니다…</Text>
      )}
    </Screen>
  );
}
