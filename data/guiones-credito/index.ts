import { LOTE_01 } from "./lote-01-vida-cotidiana";
import { LOTE_02 } from "./lote-02-objeciones";
import { LOTE_03 } from "./lote-03-momentos";
import { LOTE_04 } from "./lote-04-vsl";
export type { VarianteGuion } from "./tipos";

/** Todas las variantes escritas a mano para el vertical de crédito. */
export const VARIANTES_CREDITO = [...LOTE_01, ...LOTE_02, ...LOTE_03, ...LOTE_04];
