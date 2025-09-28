import { NLPLanguageConfig } from "./types";

/**
 * Japanese language configuration for Natural Language Processing
 * Translated patterns for Japanese-speaking users
 */
export const jaConfig: NLPLanguageConfig = {
	code: "ja",
	name: "日本語",
	chronoLocale: "ja", // chrono-node has Japanese support

	dateTriggers: {
		due: ["期限", "締切", "〆切", "まで", "までに", "に"],
		scheduled: ["予定", "計画", "開始", "から", "に開始", "を開始"],
	},

	recurrence: {
		frequencies: {
			daily: ["毎日", "日々", "毎日毎日", "連日"],
			weekly: ["毎週", "週毎", "週一", "毎週毎週"],
			monthly: ["毎月", "月毎", "月一", "毎月毎月"],
			yearly: ["毎年", "年毎", "年一", "毎年毎年", "年次"],
		},

		every: ["毎", "各", "全て"],
		other: ["他の", "別の", "異なる"],

		weekdays: {
			monday: ["月曜日", "月曜", "月", "げつようび"],
			tuesday: ["火曜日", "火曜", "火", "かようび"],
			wednesday: ["水曜日", "水曜", "水", "すいようび"],
			thursday: ["木曜日", "木曜", "木", "もくようび"],
			friday: ["金曜日", "金曜", "金", "きんようび"],
			saturday: ["土曜日", "土曜", "土", "どようび"],
			sunday: ["日曜日", "日曜", "日", "にちようび"],
		},

		pluralWeekdays: {
			monday: ["月曜日", "月曜", "月", "げつようび"],
			tuesday: ["火曜日", "火曜", "火", "かようび"],
			wednesday: ["水曜日", "水曜", "水", "すいようび"],
			thursday: ["木曜日", "木曜", "木", "もくようび"],
			friday: ["金曜日", "金曜", "金", "きんようび"],
			saturday: ["土曜日", "土曜", "土", "どようび"],
			sunday: ["日曜日", "日曜", "日", "にちようび"],
		},

		ordinals: {
			first: ["最初の", "第一の", "一番目の", "初回"],
			second: ["二番目の", "第二の", "次の"],
			third: ["三番目の", "第三の"],
			fourth: ["四番目の", "第四の"],
			last: ["最後の", "最終の", "終わりの"],
		},

		periods: {
			day: ["日", "日間"],
			week: ["週", "週間"],
			month: ["月", "月間", "ヶ月"],
			year: ["年", "年間"],
		},
	},

	timeEstimate: {
		hours: ["時間", "時", "じかん"],
		minutes: ["分", "分間", "ふん", "ぷん"],
	},

	fallbackStatus: {
		open: ["未着手", "新規", "オープン", "開始前", "待機"],
		inProgress: ["進行中", "作業中", "実行中", "処理中", "進行"],
		done: ["完了", "終了", "済み", "終わり", "達成"],
		cancelled: ["キャンセル", "中止", "取消", "廃止", "停止"],
		waiting: ["待機", "保留", "ブロック", "一時停止", "待ち"],
	},

	fallbackPriority: {
		urgent: ["緊急", "至急", "急務", "最優先", "すぐに"],
		high: ["高", "重要", "優先", "高優先度", "重点"],
		normal: ["普通", "通常", "標準", "一般", "ノーマル"],
		low: ["低", "軽微", "後回し", "低優先度", "余裕"],
	},
};
