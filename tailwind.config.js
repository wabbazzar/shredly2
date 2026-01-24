/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {}
	},
	plugins: [
		// Landscape variant for phone rotation (AirPlay screen casting)
		// max-height: 500px ensures phones trigger (350-430px) but not desktop monitors (700px+)
		function({ addVariant }) {
			addVariant('landscape', '@media (orientation: landscape) and (max-height: 500px)');
		}
	]
};
