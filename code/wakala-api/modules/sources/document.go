package sources

import (
	"context"
	"fmt"
	"strings"

	"gorm.io/gorm"
)

const (
	FormatText     = "text"
	FormatMarkdown = "markdown"
)

type passage struct {
	heading string
	start   int
	end     int
}

func (m *sourceManager) AddDocument(ctx context.Context, in Document) ([]Chunk, error) {
	format := in.Format
	if format == "" {
		format = FormatText
	}
	if format != FormatText && format != FormatMarkdown {
		return nil, fmt.Errorf("%w: format %q is neither %q nor %q", ErrInvalidDocument, in.Format, FormatText, FormatMarkdown)
	}
	if strings.TrimSpace(in.Text) == "" {
		return nil, fmt.Errorf("%w: the document has no text", ErrInvalidDocument)
	}
	if _, err := m.GetSource(ctx, in.SourceID); err != nil {
		return nil, err
	}

	passages := splitDocument(in.Text, format == FormatMarkdown)
	if len(passages) == 0 {
		return nil, fmt.Errorf("%w: the document has no passages, only headings", ErrInvalidDocument)
	}
	first, err := m.nextPosition(ctx, in.SourceID)
	if err != nil {
		return nil, err
	}

	created := m.now()
	out := make([]Chunk, 0, len(passages))
	rows := make([]map[string]any, 0, len(passages))
	for i, p := range passages {
		c := Chunk{
			ID:          newID(),
			SourceID:    in.SourceID,
			Position:    first + i,
			Text:        in.Text[p.start:p.end],
			Heading:     p.heading,
			StartOffset: p.start,
			EndOffset:   p.end,
			CreatedAt:   created,
		}
		row, err := encode(m.st.Object(roleChunk), c)
		if err != nil {
			return nil, fmt.Errorf("AddDocument: %w", err)
		}
		out = append(out, c)
		rows = append(rows, row)
	}

	err = m.st.Query(ctx, roleChunk).Transaction(func(tx *gorm.DB) error {
		for _, row := range rows {
			if err := tx.Table(m.st.Table(roleChunk)).Create(row).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("AddDocument: %w", err)
	}
	return out, nil
}

func (m *sourceManager) nextPosition(ctx context.Context, sourceID string) (int, error) {
	var count int64
	if err := m.st.Query(ctx, roleChunk).Where("source_id = ?", sourceID).Count(&count).Error; err != nil {
		return 0, fmt.Errorf("AddDocument: %w", err)
	}
	return int(count), nil
}

func splitDocument(text string, markdown bool) []passage {
	var out []passage
	var trail [6]string
	start, end := -1, -1
	flush := func() {
		if start >= 0 {
			out = append(out, passage{heading: headingPath(trail), start: start, end: end})
		}
		start, end = -1, -1
	}

	fenced := false
	for offset := 0; offset < len(text); {
		lineEnd := strings.IndexByte(text[offset:], '\n')
		next := len(text)
		if lineEnd >= 0 {
			next = offset + lineEnd + 1
			lineEnd = offset + lineEnd
		} else {
			lineEnd = len(text)
		}
		line := strings.TrimRight(text[offset:lineEnd], "\r")

		if markdown && strings.HasPrefix(strings.TrimSpace(line), "```") {
			fenced = !fenced
		}
		if level, title, ok := headingOf(line); markdown && !fenced && ok {
			flush()
			trail[level-1] = title
			for i := level; i < len(trail); i++ {
				trail[i] = ""
			}
		} else if strings.TrimSpace(line) == "" && !fenced {
			flush()
		} else {
			if start < 0 {
				start = offset + leadingSpace(line)
			}
			end = offset + len(strings.TrimRight(line, " \t"))
		}
		offset = next
	}
	flush()
	return out
}

func headingOf(line string) (int, string, bool) {
	level := 0
	for level < len(line) && line[level] == '#' {
		level++
	}
	if level == 0 || level > 6 {
		return 0, "", false
	}
	rest := line[level:]
	if rest != "" && rest[0] != ' ' && rest[0] != '\t' {
		return 0, "", false
	}
	title := strings.TrimSpace(strings.TrimRight(strings.TrimSpace(rest), "#"))
	return level, title, true
}

func headingPath(trail [6]string) string {
	var named []string
	for _, t := range trail {
		if t != "" {
			named = append(named, t)
		}
	}
	return strings.Join(named, " / ")
}

func leadingSpace(line string) int {
	return len(line) - len(strings.TrimLeft(line, " \t"))
}
