/**
 * QR codes for the TaskNotes mobile app's store pages, as SVG path data (error
 * correction M, no quiet zone; the renderer adds one). Generated once with the
 * qrcode package (1.5.4), so the plugin does not bundle a QR encoder. Regenerate
 * a code if its URL changes:
 *   QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 0 })
 * and copy the viewBox size and the dark path's `d` attribute here.
 */
export interface StoreQrCode {
	url: string;
	/** Modules per side. */
	size: number;
	path: string;
}

export const APP_STORE_QR: StoreQrCode = {
	url: "https://apps.apple.com/app/tasknotes/id6797168033",
	size: 33,
	path: "M0 0.5h7m1 0h1m1 0h4m1 0h2m1 0h1m4 0h1m2 0h7M0 1.5h1m5 0h1m2 0h1m1 0h1m1 0h2m1 0h1m1 0h2m1 0h1m2 0h1m1 0h1m5 0h1M0 2.5h1m1 0h3m1 0h1m3 0h3m1 0h8m2 0h1m1 0h1m1 0h3m1 0h1M0 3.5h1m1 0h3m1 0h1m1 0h2m5 0h3m1 0h1m1 0h2m1 0h1m1 0h1m1 0h3m1 0h1M0 4.5h1m1 0h3m1 0h1m1 0h1m1 0h2m1 0h1m2 0h2m1 0h1m3 0h2m1 0h1m1 0h3m1 0h1M0 5.5h1m5 0h1m1 0h5m1 0h2m4 0h1m3 0h1m1 0h1m5 0h1M0 6.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M8 7.5h1m1 0h1m3 0h1m2 0h5M0 8.5h1m3 0h1m1 0h3m1 0h1m4 0h1m1 0h2m1 0h3m1 0h6m2 0h1M2 9.5h2m1 0h1m1 0h4m1 0h1m1 0h5m2 0h5m3 0h2M1 10.5h1m2 0h1m1 0h1m3 0h1m1 0h5m1 0h1m1 0h1m2 0h3m3 0h1m1 0h1M1 11.5h3m3 0h1m1 0h1m3 0h1m1 0h1m3 0h1m2 0h1m8 0h2M0 12.5h3m3 0h4m3 0h1m2 0h1m2 0h1m2 0h1m2 0h2m1 0h2M0 13.5h2m2 0h1m4 0h2m3 0h1m2 0h4m2 0h2m1 0h2m1 0h2M2 14.5h1m1 0h5m1 0h1m2 0h1m1 0h1m2 0h1m1 0h7m1 0h2m1 0h1M0 15.5h1m1 0h4m1 0h1m1 0h2m1 0h7m2 0h2m2 0h3M2 16.5h2m2 0h2m1 0h3m1 0h1m2 0h2m1 0h4m3 0h1m1 0h1m2 0h1M0 17.5h4m4 0h2m2 0h2m1 0h2m1 0h1m3 0h2m1 0h1m3 0h3M2 18.5h5m1 0h3m3 0h2m1 0h1m3 0h3m3 0h1m1 0h1m1 0h1M1 19.5h2m2 0h1m1 0h1m2 0h1m1 0h2m3 0h5m1 0h1m3 0h1m4 0h1M6 20.5h2m1 0h1m1 0h5m2 0h1m1 0h1m4 0h2m1 0h2M0 21.5h1m1 0h2m1 0h1m3 0h2m1 0h3m1 0h1m2 0h1m2 0h4m1 0h1m1 0h3M2 22.5h3m1 0h1m2 0h4m1 0h1m1 0h2m1 0h1m1 0h2m1 0h1m6 0h1M2 23.5h1m1 0h1m2 0h2m1 0h3m1 0h1m2 0h6m1 0h2m5 0h2M0 24.5h2m1 0h1m1 0h7m1 0h3m1 0h1m2 0h3m1 0h6m2 0h1M8 25.5h1m1 0h1m4 0h1m1 0h1m2 0h2m1 0h2m3 0h1m1 0h2M0 26.5h7m1 0h1m1 0h1m2 0h1m1 0h2m1 0h1m1 0h1m3 0h1m1 0h1m1 0h2m1 0h1M0 27.5h1m5 0h1m2 0h2m3 0h3m3 0h1m1 0h1m1 0h1m3 0h1m2 0h2M0 28.5h1m1 0h3m1 0h1m1 0h1m7 0h1m2 0h1m2 0h1m1 0h6m1 0h1M0 29.5h1m1 0h3m1 0h1m2 0h1m1 0h2m1 0h1m3 0h4m2 0h1m1 0h3m1 0h2M0 30.5h1m1 0h3m1 0h1m3 0h1m1 0h1m1 0h2m1 0h1m2 0h2m1 0h1m1 0h4m1 0h1M0 31.5h1m5 0h1m5 0h1m2 0h3m3 0h4m1 0h1m2 0h1M0 32.5h7m1 0h1m7 0h2m1 0h4m2 0h1m6 0h1",
};

export const GOOGLE_PLAY_QR: StoreQrCode = {
	url: "https://play.google.com/store/apps/details?id=dev.tasknotes.app",
	size: 37,
	path: "M0 0.5h7m2 0h1m1 0h5m2 0h1m1 0h3m1 0h3m1 0h1m1 0h7M0 1.5h1m5 0h1m7 0h1m2 0h3m5 0h4m1 0h1m5 0h1M0 2.5h1m1 0h3m1 0h1m1 0h2m1 0h4m4 0h4m1 0h1m1 0h3m1 0h1m1 0h3m1 0h1M0 3.5h1m1 0h3m1 0h1m1 0h2m3 0h1m1 0h6m1 0h1m2 0h3m2 0h1m1 0h3m1 0h1M0 4.5h1m1 0h3m1 0h1m1 0h2m8 0h3m1 0h2m4 0h1m1 0h1m1 0h3m1 0h1M0 5.5h1m5 0h1m1 0h2m1 0h3m4 0h1m3 0h1m2 0h1m1 0h2m1 0h1m5 0h1M0 6.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M8 7.5h7m1 0h1m6 0h1m2 0h1m1 0h1M0 8.5h1m1 0h5m3 0h1m2 0h3m2 0h1m1 0h6m4 0h5M0 9.5h2m1 0h2m2 0h1m4 0h1m2 0h3m3 0h1m6 0h1m2 0h1m3 0h1M0 10.5h7m2 0h2m2 0h1m3 0h1m2 0h8m2 0h1m2 0h1m1 0h2M3 11.5h1m3 0h2m2 0h1m1 0h1m2 0h1m4 0h1m1 0h1m2 0h3m1 0h2m1 0h1m2 0h1M1 12.5h1m1 0h1m2 0h2m2 0h4m2 0h2m2 0h1m1 0h6m1 0h4m1 0h3M0 13.5h1m6 0h1m2 0h2m4 0h6m1 0h3m2 0h1m2 0h1M1 14.5h2m1 0h4m1 0h1m1 0h5m1 0h1m3 0h1m3 0h4m1 0h4m1 0h2M2 15.5h3m2 0h1m1 0h2m1 0h7m2 0h2m5 0h5m2 0h2M0 16.5h2m1 0h4m1 0h1m1 0h2m1 0h1m2 0h1m4 0h1m1 0h1m1 0h8m1 0h1M2 17.5h1m6 0h1m4 0h2m2 0h1m1 0h1m1 0h1m1 0h2m2 0h2m1 0h1m2 0h2M1 18.5h1m1 0h1m2 0h2m2 0h1m3 0h3m2 0h1m2 0h1m3 0h4m2 0h1m2 0h2M1 19.5h1m1 0h1m4 0h5m2 0h1m2 0h5m1 0h1m3 0h1m1 0h3m3 0h1M0 20.5h1m1 0h1m1 0h1m1 0h1m3 0h2m3 0h1m1 0h1m1 0h2m1 0h1m1 0h3m2 0h2m1 0h3M0 21.5h2m2 0h1m3 0h2m1 0h1m2 0h1m1 0h1m1 0h3m1 0h2m4 0h1m4 0h1M0 22.5h1m1 0h1m2 0h4m1 0h1m4 0h2m1 0h1m1 0h1m1 0h1m4 0h1m2 0h4m1 0h2M3 23.5h3m4 0h4m1 0h1m7 0h1m2 0h1m1 0h2m1 0h2m2 0h1M0 24.5h1m1 0h1m3 0h1m1 0h2m1 0h1m6 0h1m1 0h7m2 0h2m1 0h1m1 0h2M0 25.5h1m1 0h1m5 0h2m1 0h1m2 0h3m4 0h1m4 0h1m1 0h1M0 26.5h1m4 0h4m1 0h1m1 0h3m5 0h1m2 0h2m1 0h2m2 0h1m1 0h2m1 0h2M0 27.5h1m1 0h1m1 0h1m2 0h1m1 0h1m1 0h1m4 0h1m4 0h1m1 0h1m2 0h1m1 0h4m3 0h1M0 28.5h1m1 0h1m1 0h1m1 0h4m2 0h1m1 0h1m2 0h1m4 0h4m2 0h8M8 29.5h6m2 0h2m1 0h3m1 0h1m3 0h2m3 0h2m1 0h1M0 30.5h7m2 0h2m2 0h1m1 0h3m2 0h2m6 0h1m1 0h1m1 0h1m1 0h1m1 0h1M0 31.5h1m5 0h1m1 0h1m2 0h5m1 0h8m2 0h2m3 0h2m1 0h1M0 32.5h1m1 0h3m1 0h1m1 0h2m1 0h1m2 0h3m2 0h1m1 0h1m2 0h9m1 0h1m1 0h1M0 33.5h1m1 0h3m1 0h1m1 0h1m1 0h2m1 0h3m2 0h1m1 0h3m1 0h3m2 0h2m1 0h1m2 0h1M0 34.5h1m1 0h3m1 0h1m1 0h1m2 0h2m2 0h2m2 0h1m1 0h2m1 0h6m6 0h1M0 35.5h1m5 0h1m4 0h1m2 0h2m2 0h5m1 0h1m2 0h2m3 0h1m3 0h1M0 36.5h7m1 0h1m1 0h1m1 0h1m1 0h2m1 0h1m1 0h1m4 0h3m2 0h1m2 0h1m1 0h3",
};
