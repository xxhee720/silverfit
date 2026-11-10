import { useState } from "react";
import { Text } from "react-native";
import { router, Redirect } from "expo-router";
import { useSession } from "../../lib/session";
import { client } from "../../lib/client";
import { Button, Field, Screen, styles } from "../../components/ui";
export default function Reset() {
  const { session, loading } = useSession(),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!loading && !session) return <Redirect href="/auth" />;
  return (
    <Screen title="새 비밀번호 설정">
      <Field
        label="새 비밀번호 (12자 이상)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
      />
      <Button
        title="비밀번호 변경"
        busy={busy}
        onPress={() =>
          void (async () => {
            if (password.length < 12) {
              setError("12자 이상 입력해 주세요.");
              return;
            }
            setBusy(true);
            const { error } = await client.auth.updateUser({ password });
            setBusy(false);
            if (error)
              setError("변경하지 못했습니다. 복구 메일을 다시 요청해 주세요.");
            else router.replace("/");
          })()
        }
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </Screen>
  );
}
