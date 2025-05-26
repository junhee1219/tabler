"""
gpt한테 전달하기 위한 프로젝트 코드 보내는 python 파일
"""

PATH = "./"

import sys
from pathlib import Path

try:
    import pyperclip  # pip install pyperclip
    
    CLIP_AVAILABLE = True
except ImportError:
    CLIP_AVAILABLE = False


def build_tree_lines(root: Path, prefix: str = "") -> list[str]:
    """root 디렉터리 하위의 ts/tsx 파일과 서브디렉터리를 트리 형식으로 문자열 리스트로 반환."""
    entries = sorted(
        [p for p in root.iterdir()
         if p.name != "node_modules" and not p.name.startswith(".") and not p.name.startswith(
            "libs") and not p.name.startswith("dist")
         and (p.is_dir() or p.suffix in {".html", ".js", ".tsx", ".css", ".json"})],
        key=lambda p: (not p.is_dir(), p.name.lower())
    )
    lines: list[str] = []
    for idx, entry in enumerate(entries):
        connector = "└── " if idx == len(entries) - 1 else "├── "
        lines.append(f"{prefix}{connector}{entry.name}")
        if entry.is_dir() and entry.name != "node_modules" and entry.name != "libs" and entry.name != "dist" and not entry.name.startswith(
                "."):
            extension = "    " if idx == len(entries) - 1 else "│   "
            lines.extend(build_tree_lines(entry, prefix + extension))
    return lines


def gather_ts_files(root: Path) -> list[Path]:
    return sorted(p for p in root.rglob("*.js") if "node_modules" not in p.parts) \
           + sorted(p for p in root.rglob("*.tsx") if "node_modules" not in p.parts) \
           + sorted(p for p in root.rglob("*.json") if "node_modules" not in p.parts) \
           + sorted(p for p in root.rglob("*.html") if "node_modules" not in p.parts) \
           + sorted(p for p in root.rglob("*.css") if "node_modules" not in p.parts)


def main():
    root = Path(PATH)
    if not root.exists() or not root.is_dir():
        print(f"오류: '{root}'가 존재하지 않거나 디렉터리가 아닙니다.", file=sys.stderr)
        sys.exit(1)
    
    output_lines: list[str] = []
    output_lines.append("Project structure (only .js/.html/.css):")
    output_lines.extend(build_tree_lines(root))
    output_lines.append("\n\n--- File Contents ---\n")
    
    ts_files = gather_ts_files(root)
    if not ts_files:
        output_lines.append("찾은 .ts/.tsx 파일이 없습니다.")
    else:
        for file_path in ts_files:
            rel = file_path.relative_to(root)
            if str(rel) == "package-lock.json" or str(rel).startswith(".") or str(rel).startswith(
                    "node_modules") or str(rel).startswith("libs") or str(rel).startswith("dist"):
                continue
            output_lines.append(f"\n==== File: {rel} ====\n")
            try:
                text = file_path.read_text(encoding="utf-8")
            except Exception as e:
                text = f"[Error reading file: {e}]"
            output_lines.append(text)
    
    full_output = "\n".join(output_lines)
    
    # 출력
    print(full_output)
    
    # 클립보드 복사
    if CLIP_AVAILABLE:
        try:
            pyperclip.copy(full_output)
            print("\n[✅ 전체 출력이 클립보드에 복사되었습니다]")
        except Exception as e:
            print(f"\n[⚠️ 클립보드 복사 실패: {e}]")
    else:
        print("\n[⚠️ pyperclip 모듈이 설치되지 않아 클립보드 복사가 불가합니다. 'pip install pyperclip' 후 재실행하세요.]")


if __name__ == "__main__":
    main()
