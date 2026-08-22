/**
 * Proveedor compuesto: pregunta a varios en orden hasta que uno responde.
 *
 * Es la razón práctica de toda esta abstracción. El `CLAUDE.md` lo dice sin
 * rodeos: «el tier gratuito puede desaparecer sin aviso». Cuando eso pase, o
 * cuando un proveedor no cubra un deporte, el cambio debe ser una línea de
 * configuración y no una reescritura.
 */
import {
  type Capacidades,
  type CriterioBusqueda,
  type CuotasDeCierre,
  type Deporte,
  type Evento,
  type Mercado,
  type ProveedorDeCuotas,
  type ReferenciaEvento,
  type ResultadoEvento,
  ErrorProveedor,
  ErrorCuotaAgotada,
} from './dominio';

export interface Incidencia {
  proveedor: string;
  error: Error;
}

export class ProveedorConRespaldo implements ProveedorDeCuotas {
  readonly nombre: string;
  /** Lo que ha ido fallando, para poder avisar sin interrumpir el servicio. */
  readonly incidencias: Incidencia[] = [];

  constructor(private readonly proveedores: readonly ProveedorDeCuotas[]) {
    if (proveedores.length === 0) {
      throw new ErrorProveedor('con-respaldo', 'Hace falta al menos un proveedor.');
    }
    this.nombre = `con-respaldo(${proveedores.map((p) => p.nombre).join(' → ')})`;
  }

  /** La unión de lo que sabe hacer alguno: si uno cubre Euroliga, el conjunto la cubre. */
  capacidades(): Capacidades {
    const deportes = new Set<Deporte>();
    const mercados = new Set<Mercado>();
    let historico = false;
    for (const p of this.proveedores) {
      const c = p.capacidades();
      c.deportes.forEach((d) => deportes.add(d));
      c.mercados.forEach((m) => mercados.add(m));
      historico ||= c.historico;
    }
    return { deportes: [...deportes], mercados: [...mercados], historico };
  }

  /**
   * Recorre los proveedores capaces y devuelve la primera respuesta buena.
   *
   * Los que no declaran la capacidad se saltan sin gastar una petición: en un
   * tier gratuito, preguntar a quien no puede responder es tirar cuota.
   */
  private async intentar<T>(
    puede: (c: Capacidades) => boolean,
    accion: (p: ProveedorDeCuotas) => Promise<T>,
    aceptar: (r: T) => boolean,
  ): Promise<T | null> {
    let ultimo: T | null = null;
    let algunoLoIntento = false;

    for (const p of this.proveedores) {
      if (!puede(p.capacidades())) continue;
      algunoLoIntento = true;
      try {
        const resultado = await accion(p);
        if (aceptar(resultado)) return resultado;
        ultimo = resultado;
      } catch (fallo) {
        const error = fallo instanceof Error ? fallo : new Error(String(fallo));
        this.incidencias.push({ proveedor: p.nombre, error });
        /*
         * La cuota agotada no se reintenta ni se recupera: se pasa al siguiente
         * y se deja constancia. Reintentar solo gastaría el resto de la cuota.
         */
        if (!(fallo instanceof ErrorProveedor)) throw fallo;
      }
    }

    if (!algunoLoIntento) return null;
    return ultimo;
  }

  async buscarEventos(criterio: CriterioBusqueda): Promise<Evento[]> {
    const eventos = await this.intentar(
      (c) => c.deportes.includes(criterio.deporte),
      (p) => p.buscarEventos(criterio),
      (r) => r.length > 0,
    );
    return eventos ?? [];
  }

  async cuotasDeCierre(evento: ReferenciaEvento, mercado: Mercado): Promise<CuotasDeCierre | null> {
    return this.intentar(
      (c) => c.historico && c.mercados.includes(mercado),
      (p) => p.cuotasDeCierre(evento, mercado),
      (r) => r !== null,
    );
  }

  async resultados(deporte: Deporte, diasAtras: number): Promise<ResultadoEvento[]> {
    const r = await this.intentar(
      (c) => c.deportes.includes(deporte),
      (p) => p.resultados(deporte, diasAtras),
      (x) => x.length > 0,
    );
    return r ?? [];
  }

  /** True si todos los proveedores han agotado su cuota: la señal para avisar. */
  todosSinCuota(): boolean {
    const agotados = new Set(
      this.incidencias.filter((i) => i.error instanceof ErrorCuotaAgotada).map((i) => i.proveedor),
    );
    return this.proveedores.every((p) => agotados.has(p.nombre));
  }
}
