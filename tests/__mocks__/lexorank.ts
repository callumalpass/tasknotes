export class LexoRank {
	private readonly value: string;

	constructor(value: string) {
		this.value = value;
	}

	static parse(value: string): LexoRank {
		return new LexoRank(value);
	}

	static middle(): LexoRank {
		return new LexoRank("0|hzzzzz:");
	}

	genNext(): LexoRank {
		return new LexoRank(`${this.value}n`);
	}

	genPrev(): LexoRank {
		return new LexoRank(`${this.value}m`);
	}

	between(other: LexoRank): LexoRank {
		return new LexoRank(`${this.value}${other.toString()}b`);
	}

	isMax(): boolean {
		return false;
	}

	toString(): string {
		return this.value;
	}
}