import { FilterPill } from '@/components/ui/FilterPill'

interface FilterPillOption {
  value: string
  label: string
  count?: number
}

interface FilterPillGroupProps {
  options: FilterPillOption[]
  value: string
  onChange: (value: string) => void
  size?: 'default' | 'sm'
  className?: string
}

export function FilterPillGroup({ options, value, onChange, size = 'default', className }: FilterPillGroupProps) {
  return (
    <div className={`flex flex-wrap gap-2${className ? ` ${className}` : ''}`}>
      {options.map(option => (
        <FilterPill
          key={option.value}
          label={option.label}
          count={option.count}
          selected={option.value === value}
          size={size}
          onClick={() => onChange(option.value)}
        />
      ))}
    </div>
  )
}
