import { useRef, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { decode } from "base64-arraybuffer";
import { Button, Choice, Field, styles } from "./ui";
import { client, site } from "../lib/client";
import { products, type Product } from "../../../lib/domain";
import {
  estimateLength,
  type Evidence,
  type Point,
} from "../../../lib/photo-measurement";
import {
  aiNotice,
  aiResultSchema,
  type AiResult,
} from "../../../lib/ai-measurement";
export type Photo = {
  uri: string;
  width: number;
  height: number;
  bytes: ArrayBuffer;
};
export async function choosePhoto(camera: boolean): Promise<Photo | null> {
  // The system photo picker grants access only to the selected photo.
  // Request camera permission only when the user chooses to take a photo.
  if (camera) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted)
      throw Error(
        "카메라 권한이 필요합니다. 휴대폰 설정에서 허용하거나 앨범에서 사진을 선택해 주세요.",
      );
  }
  const result = camera
    ? await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 1,
        exif: false,
      })
    : await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
        exif: false,
      });
  if (result.canceled) return null;
  const source = result.assets[0],
    context = ImageManipulator.manipulate(source.uri);
  if (Math.max(source.width, source.height) > 1600)
    context.resize(
      source.width >= source.height ? { width: 1600 } : { height: 1600 },
    );
  const rendered = await context.renderAsync();
  const image = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.8,
    base64: true,
  });
  if (!image.base64) throw Error("사진을 준비하지 못했습니다.");
  const bytes = decode(image.base64);
  if (bytes.byteLength > 2 * 1024 * 1024)
    throw Error("사진이 너무 큽니다. 더 단순한 배경에서 다시 촬영해 주세요.");
  return { uri: image.uri, width: image.width, height: image.height, bytes };
}
export function PhotoEditor({
  kind,
  photo,
  onPhoto,
  onMeasure,
  onReset,
}: {
  kind: Product;
  photo: Photo | null;
  onPhoto: (p: Photo | null) => void;
  onMeasure: (e: Evidence) => void;
  onReset: () => void;
}) {
  const [points, setPoints] = useState<Point[]>([]),
    [reference, setReference] = useState("100"),
    [field, setField] = useState(Object.keys(products[kind].fields)[0]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [aiConsent, setAiConsent] = useState(false),
    [result, setResult] = useState<AiResult | null>(null);
  const width = useRef(0),
    ticket = useRef(0);
  async function pick(camera: boolean) {
    const current = ++ticket.current;
    setBusy(true);
    setError("");
    try {
      const p = await choosePhoto(camera);
      if (!p || ticket.current !== current) return;
      onPhoto(p);
      onReset();
      setPoints([]);
      setResult(null);
      setAiConsent(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "사진 처리 실패");
    } finally {
      if (ticket.current === current) setBusy(false);
    }
  }
  async function analyze() {
    if (!photo || !aiConsent) return;
    const current = ++ticket.current;
    setBusy(true);
    setResult(null);
    setError("");
    try {
      const { data } = await client.auth.getSession();
      if (!data.session) throw Error("로그인이 필요합니다.");
      const form = new FormData();
      form.append("photo", {
        uri: photo.uri,
        name: "photo.jpeg",
        type: "image/jpeg",
      } as unknown as Blob);
      form.append("product", kind);
      form.append("consent", "true");
      const response = await fetch(`${site}/api/measurements/analyze`, {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        body: form,
        signal: AbortSignal.timeout(60000),
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.error || "분석 실패");
      if (ticket.current === current)
        setResult(aiResultSchema.parse(body.result));
    } catch (e) {
      if (ticket.current === current)
        setError(e instanceof Error ? e.message : "AI 분석 실패");
    } finally {
      if (ticket.current === current) setBusy(false);
    }
  }
  return (
    <View style={{ gap: 14 }}>
      <Text style={styles.subtitle}>사진 촬영과 치수 분석</Text>
      <Text style={styles.text}>
        얼굴·주소를 제외해 주세요. 기준물 측정은 대상과 같은 평면에 자를 놓고
        정면으로 촬영합니다.
      </Text>
      <Button
        title="카메라로 촬영"
        busy={busy}
        onPress={() => void pick(true)}
      />
      <Button
        title="앨범에서 사진 선택"
        secondary
        disabled={busy}
        onPress={() => void pick(false)}
      />
      {photo && (
        <>
          <Button
            secondary
            title="사진 삭제"
            disabled={busy}
            onPress={() => {
              ticket.current++;
              onPhoto(null);
              onReset();
              setResult(null);
              setPoints([]);
            }}
          />
          <View
            onLayout={(e) => {
              width.current = e.nativeEvent.layout.width;
            }}
            style={{
              aspectRatio: photo.width / photo.height,
              position: "relative",
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="기준물 양끝, 측정 대상 양끝 순서로 네 지점을 선택하세요"
              style={{ flex: 1 }}
              onPress={(e) => {
                const x = e.nativeEvent.locationX / width.current,
                  y =
                    e.nativeEvent.locationY /
                    ((width.current * photo.height) / photo.width);
                if (
                  points.length < 4 &&
                  Number.isFinite(x) &&
                  Number.isFinite(y)
                )
                  setPoints((p) => [
                    ...p,
                    {
                      x: Math.max(0, Math.min(1, x)),
                      y: Math.max(0, Math.min(1, y)),
                    },
                  ]);
              }}
            >
              <Image
                source={{ uri: photo.uri }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="stretch"
              />
            </Pressable>
            {points.map((p, i) => (
              <View
                key={i}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: `${p.x * 100}%`,
                  top: `${p.y * 100}%`,
                  marginLeft: -12,
                  marginTop: -12,
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: "#ea580c",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  {i + 1}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.subtitle}>기준물로 계산</Text>
          <Field
            label="기준 길이 (mm)"
            value={reference}
            onChangeText={(v) => {
              setReference(v);
              setPoints([]);
            }}
            keyboardType="decimal-pad"
          />
          <Text style={styles.label}>측정할 항목</Text>
          <View style={styles.row}>
            {Object.entries(products[kind].fields).map(([k, l]) => (
              <Choice
                key={k}
                label={l}
                selected={field === k}
                onPress={() => {
                  setField(k);
                  setPoints((p) => p.slice(0, 2));
                }}
              />
            ))}
          </View>
          <Text style={styles.text}>
            {points.length < 4
              ? `${points.length + 1}/4: ${["기준물 시작점", "기준물 끝점", "대상 시작점", "대상 끝점"][points.length]}을 사진에서 눌러 주세요.`
              : "네 지점이 선택됐습니다."}
          </Text>
          <Button
            secondary
            title="지점 다시 선택"
            onPress={() => setPoints([])}
          />
          <Button
            title="계산값을 치수에 적용"
            disabled={points.length !== 4}
            onPress={() => {
              try {
                const value = estimateLength(
                  points,
                  photo.width,
                  photo.height,
                  Number(reference),
                );
                onMeasure({
                  field,
                  method: "photo-reference-v1",
                  reference_mm: Number(reference),
                  estimated_mm: value,
                  image_width: photo.width,
                  image_height: photo.height,
                  points,
                });
                setError("");
              } catch (e) {
                setError(e instanceof Error ? e.message : "계산 실패");
              }
            }}
          />
          <View style={styles.notice}>
            <Text style={styles.subtitle}>사진만으로 AI 분석 · 실험 기능</Text>
            <Text style={styles.text}>{aiNotice}</Text>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: aiConsent }}
              onPress={() => setAiConsent((v) => !v)}
              style={styles.tag}
            >
              <Text style={styles.text}>
                {aiConsent ? "☑" : "☐"} 운영자가 연결한 AI 서버로 사진을
                전송하는 데 동의합니다. AI 서버는 사진을 저장하지 않습니다.
              </Text>
            </Pressable>
            <Button
              title="기준물 없이 AI로 분석"
              disabled={!aiConsent}
              busy={busy}
              onPress={() => void analyze()}
            />
            {result && (
              <>
                <Text style={styles.subtitle}>
                  {result.status === "estimated"
                    ? `감지 영역 가로 약 ${result.visible_width_mm}mm · 세로 약 ${result.visible_height_mm}mm`
                    : "실측이 필요합니다"}
                </Text>
                {result.warnings.map((w, i) => (
                  <Text key={i} style={styles.text}>
                    {w}
                  </Text>
                ))}
                <Text style={styles.small}>
                  {result.model} · 입력한 제작 치수는 바뀌지 않습니다.
                </Text>
              </>
            )}
          </View>
        </>
      )}
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
