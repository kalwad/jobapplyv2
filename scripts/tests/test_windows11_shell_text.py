"""Windows shell anchors are searched inside their own text element (KI-0163).

Diagnostic run 41233069849 measured WebView2's TextPattern.FindText on a hosted
Windows desktop: within the "Desktop versions" region range, every result
drifted by one character per preceding line break ("0.0.1" read ".1\\nTau",
"2.12.4" read "4"), while the region's own range text was exact and the region
held exactly one Text element named "0.0.1". Static source contracts only.
"""

from __future__ import annotations

import re
from pathlib import Path

DRIVER = Path(__file__).parents[1] / "windows11" / "windows11_owned.cs"


def body(source: str, signature: str) -> str:
    start = source.index(signature)
    end = source.index("\n        }\n", start)
    return source[start:end]


def test_shell_text_searches_only_inside_the_unique_label_element() -> None:
    source = DRIVER.read_text(encoding="utf-8")
    signature = (
        "TextPatternRange ShellText(string text,"
        "AutomationElement region,TextPattern pattern)"
    )
    text = body(source, signature)
    assert (
        "region.FindAll(TreeScope.Descendants,new AndCondition(new PropertyCondition("
        "AutomationElement.NameProperty,text),new PropertyCondition("
        "AutomationElement.ControlTypeProperty,ControlType.Text)));"
    ) in text
    assert (
        "if(labels.Count!=1) throw new InvalidOperationException("
        '"Exact unique whole glyph label required");'
    ) in text
    assert "pattern.RangeFromChild(labels[0]);" in text
    # The strict whole-label, single-occurrence, visibility and ownership checks stay.
    assert "first.Compare(last)" in text
    assert "first.GetText(text.Length+1)!=text" in text
    assert "TextPattern.IsHiddenAttribute" in text
    assert 'OwnedInvariantException("Glyph label outside retained job")' in text


def test_shell_measure_never_searches_the_whole_region_range() -> None:
    source = DRIVER.read_text(encoding="utf-8")
    measure = body(
        source, "public Dictionary<string,object> ShellMeasure(string stage)"
    )
    assert "RangeFromChild(region)" not in measure
    # Diagnostic run 41248672768: at 175% zoom a text range's ScrollIntoView left the
    # anchors below the fold; the region's ScrollItemPattern brought them into view.
    assert ".ScrollIntoView(true)" not in measure
    assert (
        "region.TryGetCurrentPattern(ScrollItemPattern.Pattern,out scroll)" in measure
    )
    assert "((ScrollItemPattern)scroll).ScrollIntoView();" in measure
    assert measure.index("ScrollIntoView();") < measure.index('ShellText("App version"')
    calls = re.findall(r"ShellText\(([^()]*)\)", measure)
    assert calls == [
        '"App version",region,pattern',
        '"Tauri version",region,pattern',
        "text,region,pattern",
    ]
