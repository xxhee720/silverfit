import { useCallback, useState } from "react";
import { Alert, Linking, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { client, configured, site } from "../lib/client";
import { useSession } from "../lib/session";
import { Button, Card, Screen, styles } from "../components/ui";
import { products, statuses, type Application } from "../../../lib/domain";
export default function Home() {
  const { session, loading } = useSession();
  const [rows, setRows] = useState<Application[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setRows([]);
    setError("");
    if (!session) return;
    setBusy(true);
    try {
      const { data, error: e } = await client
        .from("applications")
        .select("*")
        .eq("owner_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (e) throw e;
      setRows(data || []);
    } catch {
      setError("신청 목록을 불러오지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }, [session]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  return (
    <Screen title="일상에 맞추는, 더 편안한 이동">
      <Text style={styles.brand}>SilverFit</Text>
      <Text style={styles.text}>
        작은 불편부터 알려주세요. 함께 측정하고 맞춰갑니다.
      </Text>
      {!configured && (
        <View style={styles.notice}>
          <Text style={styles.text}>
            연결 설정 전입니다. 모바일 환경변수를 설정해 주세요.
          </Text>
        </View>
      )}
      <Card>
        <Text style={styles.subtitle}>맞춤형 이동보조 신청</Text>
        <Text style={styles.text}>문턱 경사로 · 지팡이 팁 · 지팡이 거치대</Text>
        <Button
          title={session ? "새 신청 시작하기" : "로그인하고 신청하기"}
          disabled={!configured || loading}
          onPress={() => router.push(session ? "/applications/new" : "/auth")}
        />
      </Card>
      {session && (
        <>
          <Text style={styles.subtitle}>내 신청 현황</Text>
          <Button
            title="신청 목록 새로고침"
            secondary
            busy={busy}
            onPress={() => void load()}
          />
          {error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          {!busy && !error && rows.length === 0 && (
            <Text style={styles.text}>아직 등록한 신청이 없습니다.</Text>
          )}
          {rows.map((a) => (
            <Card key={a.id}>
              <Text style={styles.subtitle}>{products[a.product].name}</Text>
              <Text style={styles.text}>
                {a.beneficiary_name} · {statuses[a.status]}
              </Text>
              <Button
                secondary
                title="진행 상황 보기"
                onPress={() =>
                  router.push({
                    pathname: "/applications/[id]",
                    params: { id: a.id },
                  })
                }
              />
            </Card>
          ))}
        </>
      )}
      <Button
        title="계정·개인정보·탈퇴"
        secondary
        onPress={() => router.push("/account")}
      />
      <Button
        title="서비스 웹사이트"
        secondary
        onPress={() =>
          void Linking.openURL(site).catch(() =>
            Alert.alert("주소를 열 수 없습니다."),
          )
        }
      />
    </Screen>
  );
}
