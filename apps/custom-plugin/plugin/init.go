package plugin

import "github.com/lyeve-labs/lyeve-core/pkg/core"

func init() {
	core.RegisterPlugin(Name, New)
}
