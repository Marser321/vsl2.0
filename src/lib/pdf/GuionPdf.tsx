import { join } from "node:path";
import {
  Document,
  Font,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import { MARK_PATH } from "@/components/Brandmark";
import { separarGuion, type BloqueGuion } from "@/lib/guion";
import { analyzeScript, fmtTime } from "@/lib/readtime";

/**
 * Exportación de un guion con la identidad de AD Media Solution.
 *
 * Replica la estética de los entregables que la agencia ya manda a sus
 * clientes: portada oscura con el logo, páginas de contenido en blanco con
 * cabecera y pie de marca, y los beats con su rango de tiempo. No es una
 * estética inventada — sale de los PDF reales del estudio.
 *
 * Tipografía: la Geist de la marca, empaquetada en el repo. Se registra desde
 * el filesystem y no por URL para no depender de una descarga en cada render;
 * `next.config.ts` la declara en `outputFileTracingIncludes` para que el
 * archivo viaje al bundle de la función en Vercel.
 */

const DIR_FUENTES = join(process.cwd(), "src/lib/pdf/fonts");

/**
 * El registro corre una sola vez por proceso. `Font.register` es idempotente
 * pero el guard evita repetir el trabajo en cada request de una instancia viva.
 */
let fuentesListas = false;
function registrarFuentes() {
  if (fuentesListas) return;
  Font.register({
    family: "Geist",
    fonts: [
      { src: join(DIR_FUENTES, "Geist-Regular.ttf"), fontWeight: 400 },
      { src: join(DIR_FUENTES, "Geist-Bold.ttf"), fontWeight: 700 },
    ],
  });
  // Geist no trae itálica en los pesos que empaquetamos: sin esto, react-pdf
  // buscaría una variante inexistente para las acotaciones y fallaría.
  Font.registerHyphenationCallback((palabra) => [palabra]);
  fuentesListas = true;
}

const C = {
  navy: "#01327f",
  blue: "#488eff",
  sky: "#81e7ff",
  ink: "#2e3033",
  mist: "#f3fafd",
  white: "#fefefe",
  // Fondo de portada: el navy de marca oscurecido, como en los entregables.
  cover: "#061426",
  gris: "#8a929c",
  grisClaro: "#c9cfd6",
  linea: "#e6ebf0",
};

const s = StyleSheet.create({
  // ── Portada ──────────────────────────────────────────────────────────────
  cover: { backgroundColor: C.cover, padding: 56, height: "100%", fontFamily: "Geist" },
  coverEyebrow: {
    color: C.sky,
    fontSize: 8,
    letterSpacing: 2.4,
    fontFamily: "Geist", fontWeight: 700,
    marginBottom: 18,
  },
  coverTitle: { color: C.white, fontSize: 30, fontFamily: "Geist", fontWeight: 700, lineHeight: 1.2 },
  coverSubtitle: { color: C.sky, fontSize: 15, marginTop: 8 },
  coverDesc: { color: C.grisClaro, fontSize: 9.5, lineHeight: 1.7, marginTop: 20, maxWidth: 380 },
  coverBoxes: { flexDirection: "row", gap: 14, marginTop: "auto" },
  coverBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#1d2f4a",
    borderRadius: 6,
    padding: 12,
  },
  coverBoxLabel: { color: C.gris, fontSize: 6.5, letterSpacing: 1.4, fontFamily: "Geist", fontWeight: 700 },
  coverBoxValue: { color: C.white, fontSize: 11, fontFamily: "Geist", fontWeight: 700, marginTop: 5 },
  coverBoxHint: { color: C.gris, fontSize: 8, marginTop: 2 },
  chips: { flexDirection: "row", gap: 7, marginTop: 16, flexWrap: "wrap" },
  chip: {
    borderWidth: 1,
    borderColor: "#1d2f4a",
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
    color: C.grisClaro,
    fontSize: 7,
    letterSpacing: 0.9,
  },
  chipStrong: { backgroundColor: C.blue, borderColor: C.blue, color: C.white },
  coverUrl: { color: C.gris, fontSize: 7.5, letterSpacing: 1.6, marginTop: 22, textAlign: "right" },

  // ── Páginas de contenido ─────────────────────────────────────────────────
  page: { fontFamily: "Geist", paddingTop: 66, paddingBottom: 54, paddingHorizontal: 52, fontSize: 10, color: C.ink },
  header: {
    position: "absolute",
    top: 26,
    left: 52,
    right: 52,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: C.linea,
    paddingBottom: 8,
  },
  headerRight: { textAlign: "right" },
  headerLine: { color: C.gris, fontSize: 7, letterSpacing: 1.2 },

  beat: { marginBottom: 20 },
  beatHead: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 7 },
  beatTitle: { color: C.blue, fontSize: 8.5, letterSpacing: 1.3, fontFamily: "Geist", fontWeight: 700 },
  beatRange: { color: C.gris, fontSize: 8 },
  locucion: { fontSize: 11, lineHeight: 1.65, color: C.ink, marginBottom: 6 },
  cues: { borderLeftWidth: 2, borderLeftColor: C.linea, paddingLeft: 9, marginTop: 4, marginBottom: 4 },
  cue: { color: C.gris, fontSize: 8, lineHeight: 1.5, fontFamily: "Geist" },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 52,
    right: 52,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: C.linea,
    paddingTop: 8,
  },
  footerText: { color: C.grisClaro, fontSize: 6.5, letterSpacing: 1.1 },
});

/**
 * Caracteres que las fuentes estándar del PDF (Helvetica) sí saben dibujar:
 * Latin-1 más los tipográficos que usamos (guiones largos, comillas, puntos
 * suspensivos, medio). Todo lo demás —emojis sobre todo, que los guiones traen
 * en el texto en pantalla— se elimina: dejarlo pasar no solo no se ve, sino
 * que corrompe el carácter siguiente.
 */
const SOPORTADOS = /[^\u0000-\u00FF\u2010-\u2015\u2018\u2019\u201C\u201D\u2022\u2026\u00B7\u20AC]/gu;

function limpiar(texto: string): string {
  return texto.replace(SOPORTADOS, "").replace(/[ \t]{2,}/g, " ").trim();
}

function Logo({ size = 26, color = C.blue }: { size?: number; color?: string }) {
  // El isotipo se dibuja plano: el degradado de la app no aporta en impresión.
  return (
    <Svg width={size * 1.78} height={size} viewBox="0 0 185 104">
      <Path d={MARK_PATH} fill={color} fillRule="evenodd" />
    </Svg>
  );
}

export type DatosGuionPdf = {
  titulo: string;
  cliente: string | null;
  formato: "vsl" | "reel";
  contenido: string;
  version: number;
  /** Resumen breve del encargo para la portada. */
  descripcion?: string | null;
  fecha: Date;
};

function Beat({ bloque }: { bloque: BloqueGuion }) {
  return (
    // El beat fluye entre páginas: forzarlo entero dejaba hojas medio vacías.
    // Lo único que se protege es el encabezado, para que no quede colgado al
    // pie sin nada debajo.
    <View style={s.beat}>
      <View style={s.beatHead} minPresenceAhead={48}>
        <Text style={s.beatTitle}>{limpiar(bloque.titulo).toUpperCase()}</Text>
        {bloque.rango && <Text style={s.beatRange}>{bloque.rango}</Text>}
      </View>
      {bloque.acotaciones.length > 0 && (
        <View style={s.cues}>
          {bloque.acotaciones.map((cue, i) => (
            <Text key={i} style={s.cue}>
              {limpiar(cue)}
            </Text>
          ))}
        </View>
      )}
      {bloque.locucion.map((parrafo, i) => (
        <Text key={i} style={s.locucion}>
          {limpiar(parrafo)}
        </Text>
      ))}
    </View>
  );
}

export function GuionPdf({ datos }: { datos: DatosGuionPdf }) {
  registrarFuentes();
  const bloques = separarGuion(datos.contenido);
  const stats = analyzeScript(datos.contenido);
  const formato = datos.formato === "reel" ? "REEL" : "VSL";
  // Muchos títulos ya empiezan con el formato ("VSL · Errores del reporte…");
  // repetirlo en la cabecera daba "VSL · VSL · …".
  const tituloMayus = limpiar(datos.titulo).toUpperCase();
  const encabezadoTitulo = tituloMayus.startsWith(`${formato} `) || tituloMayus.startsWith(`${formato}·`)
    ? tituloMayus
    : `${formato} · ${tituloMayus}`;
  const fecha = datos.fecha.toLocaleDateString("es-UY", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Montevideo",
  });

  return (
    <Document
      title={datos.titulo}
      author="AD Media Solution"
      subject={`Guion de ${formato}`}
      creator="VSL Studio"
    >
      <Page size="A4" style={{ backgroundColor: C.cover }}>
        <View style={s.cover}>
          <Logo size={30} color={C.white} />
          <View style={{ marginTop: 46 }}>
            <Text style={s.coverEyebrow}>GUION DE ANUNCIO · {formato}</Text>
            <Text style={s.coverTitle}>{limpiar(datos.titulo)}</Text>
            {datos.cliente && <Text style={s.coverSubtitle}>{limpiar(datos.cliente)}</Text>}
            {datos.descripcion && <Text style={s.coverDesc}>{limpiar(datos.descripcion)}</Text>}
          </View>

          <View style={s.chips}>
            <Text style={[s.chip, s.chipStrong]}>{formato}</Text>
            <Text style={s.chip}>{stats.totalWords} PALABRAS</Text>
            <Text style={s.chip}>~{fmtTime(stats.totalSec)} LOCUTADOS</Text>
            <Text style={s.chip}>VERSIÓN {datos.version}</Text>
          </View>

          <View style={s.coverBoxes}>
            <View style={s.coverBox}>
              <Text style={s.coverBoxLabel}>PREPARADO PARA</Text>
              <Text style={s.coverBoxValue}>{datos.cliente ?? "—"}</Text>
              <Text style={s.coverBoxHint}>{fecha}</Text>
            </View>
            <View style={s.coverBox}>
              <Text style={s.coverBoxLabel}>PREPARADO POR</Text>
              <Text style={s.coverBoxValue}>AD Media Solution</Text>
              <Text style={s.coverBoxHint}>Agencia de Marketing Digital</Text>
            </View>
          </View>
          <Text style={s.coverUrl}>ADMEDIASOLUTION.COM</Text>
        </View>
      </Page>

      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          <Logo size={16} />
          <View style={s.headerRight}>
            <Text style={s.headerLine}>{encabezadoTitulo}</Text>
            {datos.cliente && <Text style={s.headerLine}>{limpiar(datos.cliente).toUpperCase()}</Text>}
          </View>
        </View>
        {bloques.map((bloque, i) => (
          <Beat key={i} bloque={bloque} />
        ))}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            AD MEDIA SOLUTION · MARKETING · AUTOMATIZACIÓN · RESULTADOS
          </Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
