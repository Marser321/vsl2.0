export class ApiKeyEngine {
  private keys: string[] = [];
  private currentIndex: number = 0;
  private exhaustedKeys: Set<string> = new Set();
  
  constructor() {
    const keysStr = process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY;
    if (!keysStr) {
      throw new Error("Falta OPENROUTER_API_KEYS en .env.local — configurala y reiniciá el servidor.");
    }
    this.keys = keysStr.split(",").map(k => k.trim()).filter(k => k.length > 0);
    if (this.keys.length === 0) {
      throw new Error("No hay claves válidas en OPENROUTER_API_KEYS.");
    }
  }

  get keyCount(): number {
    return this.keys.length;
  }

  /**
   * Obtiene la siguiente clave disponible en la rotación (Round-Robin).
   */
  getKey(): string {
    // Si todas están agotadas, limpiamos el estado (nuevo ciclo)
    if (this.exhaustedKeys.size >= this.keys.length) {
      this.exhaustedKeys.clear();
    }

    // Buscamos la siguiente clave no agotada
    for (let i = 0; i < this.keys.length; i++) {
      const key = this.keys[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
      
      if (!this.exhaustedKeys.has(key)) {
        return key;
      }
    }
    
    // Fallback: si por alguna razón extraña llega aquí, devolvemos la primera
    return this.keys[0];
  }

  /**
   * Marca una clave como agotada temporalmente (ej: 429 Rate Limit)
   */
  markExhausted(key: string) {
    this.exhaustedKeys.add(key);
  }
}

// Instancia global (singleton) para mantener el estado entre llamadas
export const apiKeyEngine = new ApiKeyEngine();
