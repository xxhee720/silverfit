import { useCallback, useState } from "react";
import { Alert, Image, Text, View } from "react-native";
import { Redirect, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  Button,
  Card,
  Choice,
  Field,
  Screen,
  styles,
} from "../../components/ui";
import { client } from "../../lib/client";
import { useSession } from "../../lib/session";
import {
  products,
  statuses,
  type Application,
  type Status,
} from "../../../../lib/domain";
import { choosePhoto } from "../../components/photo-editor";
import { uploadPhoto } from "../../lib/applications";
type Event = {
  id: number;
  to_status: Status;
  reason: string;
  created_at: string;
};
export default function Detail() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { session, loading } = useSession();
  const [a, setA] = useState<Application | null>(null),
    [photos, setPhotos] = useState<string[]>([]),
    [events, setEvents] = useState<Event[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [body, setBody] = useState(""),
    [score, setScore] = useState(4),
    [incident, setIncident] = useState(false),
    [message, setMessage] = useState("");
  const load = useCallback(async () => {
    if (!session || !id) return;
    setBusy(true);
    setA(null);
    setError("");
    setPhotos([]);
    try {
      const { data, error: e } = await client
        .from("applications")
        .select("*")
        .eq("id", id)
        .eq("owner_id", session.user.id)
        .single();
      if (e) throw e;
      setA(data);
      const [attached, history] = await Promise.all([
        client.from("attachments").select("path").eq("application_id", id),
        client
          .from("status_events")
          .select("id,to_status,reason,created_at")
          .eq("application_id", id)
          .order("id"),
      ]);
      if (attached.error || history.error) throw Error("진행 이력 조회 실패");
      const links = await Promise.all(
        (attached.data || []).map(async (f) => {
          const { data, error } = await client.storage
            .from("application-photos")
            .createSignedUrl(f.path, 1800);
          return error ? null : data.signedUrl;
        }),
      );
      setPhotos(links.filter((x): x is string => Boolean(x)));
      setEvents((history.data || []) as Event[]);
    } catch {
      setError(
        "신청을 불러올 수 없습니다. 본인 신청인지 확인하고 다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }, [id, session]);
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        setPhotos([]);
        setA(null);
      };
    }, [load]),
  );
  if (!loading && !session) return <Redirect href="/auth" />;
  async function attach() {
    setBusy(true);
    try {
      const p = await choosePhoto(false);
      if (p) await uploadPhoto(id, p);
      await load();
    } catch {
      Alert.alert("사진 첨부 실패", "사진을 다시 선택해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  async function feedback() {
    setBusy(true);
    setMessage("");
    try {
      if (body.trim().length < 5) throw Error("의견을 5자 이상 적어 주세요.");
      const { error } = await client.rpc("add_feedback", {
        app_id: id,
        score,
        body: body.trim(),
        incident,
      });
      if (error) throw error;
      setBody("");
      setMessage(
        incident
          ? "문제를 신고했습니다. 보조장치 사용을 멈추고 담당자에게 연락해 주세요."
          : "의견을 등록했습니다.",
      );
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "의견 등록 실패");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title="신청 진행 상황">
      <Button
        title="새로고침"
        secondary
        busy={busy}
        onPress={() => void load()}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      {a && (
        <>
          <Card>
            <Text style={styles.subtitle}>{products[a.product].name}</Text>
            <Text style={styles.brand}>{statuses[a.status]}</Text>
            <Text style={styles.text}>
              {a.beneficiary_name} · {a.contact}
            </Text>
            <Text style={styles.text}>{a.problem}</Text>
            <Text style={styles.text}>{a.environment}</Text>
            <Text style={styles.small}>
              설계·제작·안전성 검토를 거쳐 담당자가 전달합니다. 사용 승인 전에는
              사용하지 마세요.
            </Text>
          </Card>
          <Card>
            <Text style={styles.subtitle}>등록된 치수</Text>
            {Object.entries(products[a.product].fields).map(([k, l]) => (
              <Text style={styles.text} key={k}>
                {l}: {a.measurements[k]}mm
                {a.measurement_evidence?.some((e) => e.field === k)
                  ? " · 사진 계산값"
                  : ""}
              </Text>
            ))}
            <Text style={styles.small}>
              사진 계산값은 제작 전 실측 확인이 필요합니다.
            </Text>
          </Card>
          <Card>
            <Text style={styles.subtitle}>신청 사진</Text>
            {photos.map((url) => (
              <Image
                key={url}
                source={{ uri: url }}
                style={{ width: "100%", height: 260, borderRadius: 12 }}
                resizeMode="contain"
              />
            ))}
            {!photos.length && (
              <Text style={styles.text}>표시할 사진이 없습니다.</Text>
            )}
            <Button
              title="사진 추가·재첨부"
              secondary
              busy={busy}
              onPress={() => void attach()}
            />
          </Card>
          <Card>
            <Text style={styles.subtitle}>진행 이력</Text>
            {events.map((e) => (
              <View key={e.id}>
                <Text style={styles.label}>{statuses[e.to_status]}</Text>
                <Text style={styles.text}>{e.reason}</Text>
                <Text style={styles.small}>
                  {new Date(e.created_at).toLocaleDateString("ko-KR")}
                </Text>
              </View>
            ))}
          </Card>
          {(["delivered", "evaluating", "closed"] as string[]).includes(
            a.status,
          ) && (
            <Card>
              <Text style={styles.subtitle}>사용 후 의견</Text>
              <Text style={styles.label}>만족도</Text>
              <View style={styles.row}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Choice
                    key={n}
                    label={`${n}점`}
                    selected={score === n}
                    onPress={() => setScore(n)}
                  />
                ))}
              </View>
              <Field
                label="사용 후기·개선 요청"
                value={body}
                onChangeText={setBody}
                multiline
                maxLength={2000}
              />
              <Choice
                label="파손·미끄러짐 등 안전 문제 신고"
                selected={incident}
                onPress={() => setIncident((v) => !v)}
              />
              <Button
                title="의견 등록"
                busy={busy}
                onPress={() => void feedback()}
              />
            </Card>
          )}
          {message && (
            <Text accessibilityRole="alert" style={styles.text}>
              {message}
            </Text>
          )}
        </>
      )}
    </Screen>
  );
}
