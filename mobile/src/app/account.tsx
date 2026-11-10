import { Alert, Linking, Text } from "react-native";
import { router } from "expo-router";
import { useState } from "react";
import { useSession } from "../lib/session";
import { client, site } from "../lib/client";
import { Button, Card, Screen, styles } from "../components/ui";
export default function Account() {
  const { session } = useSession(),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function requestDeletion() {
    setBusy(true);
    const { error } = await client.rpc("request_account_deletion");
    setBusy(false);
    setMessage(
      error
        ? "삭제 요청을 접수하지 못했습니다. 인터넷 연결과 서비스 설정을 확인해 주세요."
        : "계정 삭제 요청이 접수됐습니다. 아직 삭제된 상태는 아닙니다. 담당자가 본인 확인 및 보존 사유를 검토한 뒤 처리합니다.",
    );
  }
  return (
    <Screen title="계정과 개인정보">
      <Card>
        <Text style={styles.subtitle}>
          {session?.user.email || "로그인이 필요합니다"}
        </Text>
        <Text style={styles.text}>
          사진은 비공개로 저장됩니다. AI 분석을 선택하면 별도 모델 서버로 사진이
          전송되며, AI 서버는 사진을 저장하지 않습니다.
        </Text>
        <Button
          title="개인정보 처리 안내"
          secondary
          onPress={() => void Linking.openURL(`${site}/privacy`)}
        />
        {session ? (
          <>
            <Button
              title="로그아웃"
              secondary
              onPress={() =>
                void (async () => {
                  const { error } = await client.auth.signOut();
                  if (error) {
                    setMessage("로그아웃하지 못했습니다. 다시 시도해 주세요.");
                    return;
                  }
                  router.replace("/");
                })()
              }
            />
            <Button
              title="계정 및 개인정보 삭제 요청"
              busy={busy}
              secondary
              onPress={() =>
                Alert.alert(
                  "계정 삭제 요청",
                  "계정·신청·사진의 삭제를 요청합니다. 안전성 기록 등의 보존 여부를 담당자가 확인하며, 요청 즉시 삭제되지는 않습니다.",
                  [
                    { text: "취소", style: "cancel" },
                    {
                      text: "삭제 요청 접수",
                      style: "destructive",
                      onPress: () => void requestDeletion(),
                    },
                  ],
                )
              }
            />
          </>
        ) : (
          <Button
            title="로그인·회원가입"
            onPress={() => router.push("/auth")}
          />
        )}
        <Text accessibilityRole="alert" style={styles.text}>
          {message}
        </Text>
      </Card>
    </Screen>
  );
}
