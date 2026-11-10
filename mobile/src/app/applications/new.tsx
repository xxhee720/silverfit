import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import {
  Button,
  Card,
  Choice,
  Field,
  Screen,
  styles,
} from "../../components/ui";
import { PhotoEditor, type Photo } from "../../components/photo-editor";
import { useSession } from "../../lib/session";
import { client } from "../../lib/client";
import { uploadPhoto } from "../../lib/applications";
import {
  applicationSchema,
  products,
  roles,
  type Product,
} from "../../../../lib/domain";
import type { Evidence } from "../../../../lib/photo-measurement";
export default function New() {
  const { session, loading } = useSession();
  const [kind, setKind] = useState<Product>("ramp"),
    [role, setRole] = useState<keyof typeof roles>("self"),
    [name, setName] = useState(""),
    [contact, setContact] = useState(""),
    [problem, setProblem] = useState(""),
    [environment, setEnvironment] = useState(""),
    [values, setValues] = useState<Record<string, string>>({}),
    [evidence, setEvidence] = useState<Record<string, Evidence>>({}),
    [photo, setPhoto] = useState<Photo | null>(null),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!loading && !session) return <Redirect href="/auth" />;
  async function submit() {
    if (busy) return;
    setError("");
    const input = applicationSchema.safeParse({
      product: kind,
      applicant_role: role,
      beneficiary_name: name,
      contact,
      problem,
      environment,
      consent,
      measurements: Object.fromEntries(
        Object.keys(products[kind].fields).map((k) => [k, Number(values[k])]),
      ),
    });
    if (!input.success) {
      setError("필수 항목·전화번호·치수·동의를 확인해 주세요.");
      return;
    }
    setBusy(true);
    try {
      const { data: id, error: e } = await client.rpc("create_application", {
        payload: {
          ...input.data,
          measurement_evidence: Object.values(evidence),
        },
      });
      if (e || typeof id !== "string") throw e || Error("접수 실패");
      if (photo) {
        try {
          await uploadPhoto(id, photo);
        } catch {
          Alert.alert(
            "신청은 접수됐습니다",
            "사진 첨부에 실패했습니다. 신청 상세에서 다시 첨부해 주세요.",
          );
        }
      }
      setPhoto(null);
      router.replace({ pathname: "/applications/[id]", params: { id } });
    } catch {
      setError(
        "신청을 접수하지 못했습니다. 입력 내용과 인터넷 연결을 확인해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title="새 보조장치 신청">
      <Card>
        <Text style={styles.subtitle}>01 필요한 보조장치</Text>
        {Object.entries(products).map(([k, p]) => (
          <Choice
            key={k}
            label={`${p.name}${p.important ? " · 안전 검증 필수" : ""}`}
            selected={kind === k}
            onPress={() => {
              setKind(k as Product);
              setValues({});
              setEvidence({});
            }}
          />
        ))}
      </Card>
      <Card>
        <Text style={styles.subtitle}>02 신청자와 사용 환경</Text>
        <View style={styles.row}>
          {Object.entries(roles).map(([k, l]) => (
            <Choice
              key={k}
              label={l}
              selected={role === k}
              onPress={() => setRole(k as keyof typeof roles)}
            />
          ))}
        </View>
        <Field
          label="사용하실 분의 이름"
          value={name}
          onChangeText={setName}
          maxLength={60}
        />
        <Field
          label="연락 가능한 전화번호"
          value={contact}
          onChangeText={setContact}
          keyboardType="phone-pad"
          maxLength={30}
        />
        <Field
          label="불편한 상황 (5자 이상)"
          value={problem}
          onChangeText={setProblem}
          multiline
          maxLength={2000}
        />
        <Field
          label="사용 장소·바닥·설치 환경"
          value={environment}
          onChangeText={setEnvironment}
          multiline
          maxLength={1000}
        />
      </Card>
      <Card>
        <Text style={styles.subtitle}>03 치수와 사진</Text>
        <PhotoEditor
          key={kind}
          kind={kind}
          photo={photo}
          onPhoto={setPhoto}
          onReset={() => setEvidence({})}
          onMeasure={(e) => {
            setValues((v) => ({ ...v, [e.field]: String(e.estimated_mm) }));
            setEvidence((v) => ({ ...v, [e.field]: e }));
          }}
        />
        {Object.entries(products[kind].fields).map(([k, l]) => (
          <View key={k}>
            <Field
              label={`${l} (mm)`}
              value={values[k] || ""}
              keyboardType="decimal-pad"
              onChangeText={(v) => {
                setValues((old) => ({ ...old, [k]: v }));
                setEvidence((old) => {
                  const next = { ...old };
                  delete next[k];
                  return next;
                });
              }}
            />
            {evidence[k] && (
              <Text style={styles.small}>사진 계산값 · 실측 확인 필요</Text>
            )}
          </View>
        ))}
      </Card>
      <Card>
        <Text style={styles.subtitle}>신청 전 확인</Text>
        <Text style={styles.text}>
          이름·연락처·환경·치수·사진을 맞춤 제작과 연락, 사용 평가를 위해
          수집합니다. 본인과 담당자만 조회합니다. 대리 신청 시 당사자에게
          설명하고 동의를 확인해 주세요. 계정 화면에서 삭제를 요청할 수
          있습니다.
        </Text>
        <Text style={styles.text}>
          신청은 제작 요청입니다. 문턱 경사로와 지팡이 팁은 낙상에 영향을 줄 수
          있어 실측과 출력물 안전성 검토 후 사용을 승인합니다. AI 추정만으로
          제작하거나 사용하지 않습니다.
        </Text>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
          onPress={() => setConsent((v) => !v)}
          style={styles.tag}
        >
          <Text style={styles.text}>
            {consent ? "☑" : "☐"} 참여 및 개인정보 처리에 동의하며, 대리 신청 시
            당사자의 동의를 확인했습니다.
          </Text>
        </Pressable>
      </Card>
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Button
        title="신청 접수하기"
        busy={busy}
        disabled={!session}
        onPress={() => void submit()}
      />
    </Screen>
  );
}
