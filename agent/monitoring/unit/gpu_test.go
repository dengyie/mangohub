package monitoring

import (
	"testing"
)

func TestGpuName(t *testing.T) {
	name := GpuName()
	if name == "" || name == "Unknown" {
		t.Errorf("Expected GPU name, got empty or 'Unknown'")
	}
	t.Logf("GPU name: %s", name)
}

func TestFormatGPUNameList(t *testing.T) {
	got := formatGPUNameList([]string{
		"NVIDIA GeForce RTX 4090",
		"NVIDIA GeForce RTX 4090",
		"AMD Radeon RX 7900 XTX",
	})
	want := "NVIDIA GeForce RTX 4090 × 2, AMD Radeon RX 7900 XTX"
	if got != want {
		t.Fatalf("formatGPUNameList() = %q, want %q", got, want)
	}
}

// Windows 上装了虚拟显示驱动后，DXGI 会把同一块 NVIDIA 卡重复枚举多次
// （同名、同 vendor/device、仅 LUID 不同）。此时应以 nvidia-smi 的物理卡列表为准。
func TestBuildGPUNameListPrefersNvidiaSMI(t *testing.T) {
	adapters := []gpuAdapterName{
		{Name: "NVIDIA GeForce RTX 3070", VendorID: 0x10DE, LUID: "0x00000000968A1604"},
		{Name: "NVIDIA GeForce RTX 3070", VendorID: 0x10DE, LUID: "0x00000000968A0AC5"},
		{Name: "NVIDIA GeForce RTX 3070", VendorID: 0x10DE, LUID: "0x000000000000BA34"},
		{Name: "Microsoft Basic Render Driver", VendorID: 0x1414, LUID: "0x000000000000C940", Software: true},
	}

	got := buildGPUNameList(adapters, []string{"NVIDIA GeForce RTX 3070"})
	if want := "NVIDIA GeForce RTX 3070"; got != want {
		t.Fatalf("buildGPUNameList() = %q, want %q", got, want)
	}
}

func TestBuildGPUNameListKeepsOtherVendors(t *testing.T) {
	adapters := []gpuAdapterName{
		{Name: "NVIDIA GeForce RTX 3070", VendorID: 0x10DE, LUID: "0x1"},
		{Name: "NVIDIA GeForce RTX 3070", VendorID: 0x10DE, LUID: "0x2"},
		{Name: "Intel(R) UHD Graphics 770", VendorID: 0x8086, LUID: "0x3"},
	}

	got := buildGPUNameList(adapters, []string{"NVIDIA GeForce RTX 3070"})
	want := "NVIDIA GeForce RTX 3070, Intel(R) UHD Graphics 770"
	if got != want {
		t.Fatalf("buildGPUNameList() = %q, want %q", got, want)
	}
}

func TestBuildGPUNameListFallsBackToDXGI(t *testing.T) {
	adapters := []gpuAdapterName{
		{Name: "AMD Radeon RX 7900 XTX", VendorID: 0x1002, LUID: "0x1"},
		{Name: "AMD Radeon RX 7900 XTX", VendorID: 0x1002, LUID: "0x1"}, // 同一适配器重复返回
		{Name: "AMD Radeon RX 7900 XTX", VendorID: 0x1002, LUID: "0x2"}, // 第二块真实显卡
	}

	got := buildGPUNameList(adapters, nil)
	if want := "AMD Radeon RX 7900 XTX × 2"; got != want {
		t.Fatalf("buildGPUNameList() = %q, want %q", got, want)
	}
}

func TestBuildGPUNameListCountsRealMultiGPU(t *testing.T) {
	got := buildGPUNameList(nil, []string{
		"NVIDIA GeForce RTX 3070",
		"NVIDIA GeForce RTX 3070",
		"NVIDIA GeForce RTX 3070",
	})
	if want := "NVIDIA GeForce RTX 3070 × 3"; got != want {
		t.Fatalf("buildGPUNameList() = %q, want %q", got, want)
	}
}
