import type { ChangeEventHandler } from 'react'

interface SearchBoxProps {
  value: string
  onChange: (value: string) => void
  onClear: () => void
}

export const SearchBox = ({ value, onChange, onClear }: SearchBoxProps) => {
  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    onChange(event.target.value)
  }

  return (
    <div className="search-box">
      <input
        type="search"
        className="search-box__input"
        aria-label="作物検索"
        placeholder="作物名・カテゴリで検索"
        value={value}
        onChange={handleChange}
      />
      {value && (
        <button
          type="button"
          className="search-box__clear"
          onClick={onClear}
        >
          クリア
        </button>
      )}
    </div>
  )
}

SearchBox.displayName = 'SearchBox'
