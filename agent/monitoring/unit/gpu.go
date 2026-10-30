package monitoring

import (
	"fmt"
	"strings"
)

const nvidiaVendorID = 0x10DE

// gpuAdapterName 是各平台枚举结果里与显示名相关的最小字段集合。
type gpuAdapterName struct {
	Name     string
	VendorID uint32
	LUID     string // DXGI 适配器 LUID；非 Windows 平台留空
	Software bool   // DXGI_ADAPTER_FLAG_SOFTWARE，软件渲染适配器
}

// buildGPUNameList 生成上报给 hub 的 gpu_name。
//
// Windows 的 DXGI 会按显示输出重复枚举同一块物理卡：装了 GameViewer / MuMu
// 这类虚拟显示驱动后会看到三条同名、同 vendor/device、仅 LUID 不同的适配器，
// 直接拼接就会把一块 3070 显示成「× 3」，而 nvidia-smi 和实际算力都只有一张卡。
// 所以 nvidia-smi 可用时以它为准（每张物理卡一条），并跳过 DXGI 里的 NVIDIA
// 适配器；nvidia-smi 不可用（AMD / Intel / 驱动异常）时退回 DXGI 按 LUID 去重，
// 非 NVIDIA 的适配器始终保留。
func buildGPUNameList(adapters []gpuAdapterName, nvidiaNames []string) string {
	names := make([]string, 0, len(adapters)+len(nvidiaNames))
	names = append(names, nvidiaNames...)

	seen := make(map[string]struct{}, len(adapters))
	for _, adapter := range adapters {
		if adapter.Software {
			continue
		}
		if len(nvidiaNames) > 0 && adapter.VendorID == nvidiaVendorID {
			continue
		}
		if adapter.LUID != "" {
			if _, ok := seen[adapter.LUID]; ok {
				continue
			}
			seen[adapter.LUID] = struct{}{}
		}
		if strings.TrimSpace(adapter.Name) != "" {
			names = append(names, adapter.Name)
		}
	}

	return formatGPUNameList(names)
}

func formatGPUNameList(names []string) string {
	counts := make(map[string]int)
	order := make([]string, 0, len(names))

	for _, name := range names {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		if counts[name] == 0 {
			order = append(order, name)
		}
		counts[name]++
	}

	if len(order) == 0 {
		return "None"
	}

	result := make([]string, 0, len(order))
	for _, name := range order {
		if counts[name] > 1 {
			result = append(result, fmt.Sprintf("%s × %d", name, counts[name]))
			continue
		}
		result = append(result, name)
	}

	return strings.Join(result, ", ")
}
