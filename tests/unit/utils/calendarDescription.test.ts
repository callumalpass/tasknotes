import {
	htmlToPlainText,
	looksLikeHtml,
	normalizeCalendarDescription,
} from "../../../src/utils/calendarDescription";

describe("calendarDescription", () => {
	describe("looksLikeHtml", () => {
		it("detects markup", () => {
			expect(looksLikeHtml("<p>Hello</p>")).toBe(true);
			expect(looksLikeHtml("Line<br>Break")).toBe(true);
			expect(looksLikeHtml('<a href="https://example.com">Link</a>')).toBe(true);
			expect(looksLikeHtml("<custom-element>Text</custom-element>")).toBe(true);
		});

		it("does not treat comparison operators as markup", () => {
			expect(looksLikeHtml("Bring < 10 items and > 2 bags")).toBe(false);
			expect(looksLikeHtml("Budget: 5 < 10")).toBe(false);
		});

		it("does not treat angle-bracketed plain text as markup", () => {
			expect(looksLikeHtml("Contact <user@example.com>")).toBe(false);
			expect(looksLikeHtml("Venue: <TBC>")).toBe(false);
		});

		it("does not treat plain text as markup", () => {
			expect(looksLikeHtml("Reference: ABC123\n\nGuests: 2")).toBe(false);
		});
	});

	describe("normalizeCalendarDescription", () => {
		it("returns plain-text descriptions unchanged", () => {
			const plain =
				"Appointment with the clinic\n\nContact: <user@example.com>\nVenue: <TBC>";
			expect(normalizeCalendarDescription(plain)).toBe(plain);
		});

		it("returns undefined for missing or empty values", () => {
			expect(normalizeCalendarDescription(undefined)).toBeUndefined();
			expect(normalizeCalendarDescription(null)).toBeUndefined();
			expect(normalizeCalendarDescription("")).toBeUndefined();
		});

		it("returns undefined when markup carries no text", () => {
			expect(normalizeCalendarDescription("<p></p><div><br></div>")).toBeUndefined();
		});

		it("flattens paragraph markup", () => {
			const html =
				"<p>Reservation confirmed on 2024-05-01.</p>\n" +
				"<p>Party of 4.\nDuration: 90 minutes.</p>";

			expect(normalizeCalendarDescription(html)).toBe(
				"Reservation confirmed on 2024-05-01.\n\nParty of 4.\nDuration: 90 minutes."
			);
		});

		it("flattens list markup, as written by the Google Calendar editor", () => {
			const html =
				"<ul><li><strong>Matinee</strong> at the Example Cinema, Screen 2</li>" +
				"<li>Reference: ABC123</li>" +
				"<li>Adult (2)</li>" +
				"<li>Seats: A1,A2</li></ul>";

			expect(normalizeCalendarDescription(html)).toBe(
				"- Matinee at the Example Cinema, Screen 2\n" +
					"- Reference: ABC123\n" +
					"- Adult (2)\n" +
					"- Seats: A1,A2"
			);
		});

		it("decodes entities so escaped punctuation is not shown literally", () => {
			const html = "<p>Meet at the Queen&#x27;s Hall, tea &amp; cake after.</p>";
			expect(normalizeCalendarDescription(html)).toBe(
				"Meet at the Queen's Hall, tea & cake after."
			);
		});
	});

	describe("htmlToPlainText", () => {
		it("turns line breaks into newlines", () => {
			expect(htmlToPlainText("First<br>Second<br />Third")).toBe("First\nSecond\nThird");
		});

		it("keeps link targets reachable", () => {
			expect(htmlToPlainText('<a href="https://example.com/booking">Booking</a>')).toBe(
				"Booking (https://example.com/booking)"
			);
		});

		it("does not duplicate a link whose label is its target", () => {
			expect(htmlToPlainText('<a href="https://example.com">https://example.com</a>')).toBe(
				"https://example.com"
			);
		});

		it("preserves an Obsidian URI written by task export", () => {
			const html =
				"<p>Project: " +
				'<a href="obsidian://open?vault=Example%20Vault&amp;file=Note.md">Note</a></p>';
			expect(htmlToPlainText(html)).toBe(
				"Project: Note (obsidian://open?vault=Example%20Vault&file=Note.md)"
			);
		});

		it("drops script and style content", () => {
			const html = "<div>Visible<script>alert(1)</script><style>.x{color:red}</style></div>";
			expect(htmlToPlainText(html)).toBe("Visible");
		});

		it("drops non-content nested inside links", () => {
			const html = '<a href="https://example.com">Visible<script>alert(1)</script></a>';
			expect(htmlToPlainText(html)).toBe("Visible (https://example.com)");
		});

		it("collapses runs of blank lines", () => {
			expect(htmlToPlainText("<p>One</p><p></p><p></p><p>Two</p>")).toBe("One\n\nTwo");
		});

		it("normalizes non-breaking spaces", () => {
			expect(htmlToPlainText("<p>Room&nbsp;12</p>")).toBe("Room 12");
		});
	});
});
