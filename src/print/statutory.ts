/** Provider contract for an authorised IRP / e-way bill integration. */
export interface StatutoryProvider {
  registerInvoice(
    documentId: string,
  ): Promise<{ irn: string; signedQr: string }>;
  generateWaybill(
    documentId: string,
    vehicleNo: string,
  ): Promise<{ number: string; validUntil: string }>;
}
export class UnconfiguredStatutoryProvider implements StatutoryProvider {
  async registerInvoice(_documentId: string): Promise<never> {
    throw new Error("E-invoice provider is unconfigured");
  }
  async generateWaybill(
    _documentId: string,
    _vehicleNo: string,
  ): Promise<never> {
    throw new Error("E-way bill provider is unconfigured");
  }
}
