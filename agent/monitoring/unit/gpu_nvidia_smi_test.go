package monitoring

import (
	"encoding/xml"
	"strings"
	"testing"
	"unicode/utf8"
)

// Windows 上 nvidia-smi 会用控制台代码页（GBK）输出 process_name，
// 使整份 XML 不是合法 UTF-8。这里复现该情况，确保清洗后仍能解析出 GPU 字段。
func TestSanitizeSMIOutputGBKProcessName(t *testing.T) {
	// 夸克 的 GBK 编码是 BF E4 BF CB
	raw := []byte("<nvidia_smi_log><gpu><product_name>NVIDIA GeForce RTX 3070 Laptop GPU</product_name>" +
		"<utilization><gpu_util>100 %</gpu_util></utilization>" +
		"<fb_memory_usage><total>8192 MiB</total><used>2752 MiB</used></fb_memory_usage>" +
		"<temperature><gpu_temp>67 C</gpu_temp></temperature>" +
		"<processes><process_info><process_name>D:\\\xbf\xe4\xbf\xcb\\Quark\\x.exe</process_name></process_info></processes>" +
		"</gpu></nvidia_smi_log>")

	if utf8.Valid(raw) {
		t.Fatal("test fixture must be invalid UTF-8 to reproduce the Windows GBK output")
	}

	out := sanitizeSMIOutput(raw)
	if !utf8.Valid(out) {
		t.Fatal("sanitized output is still invalid UTF-8")
	}
	if !strings.Contains(string(out), "Quark") {
		t.Fatal("sanitization dropped surrounding ASCII content")
	}

	var stats nvidiaSMIXMLResult
	if err := xml.Unmarshal(out, &stats); err != nil {
		t.Fatalf("unmarshal after sanitize: %v", err)
	}
	if len(stats.GPUs) != 1 {
		t.Fatalf("expected 1 GPU, got %d", len(stats.GPUs))
	}
	gpu := stats.GPUs[0]
	if gpu.ProductName != "NVIDIA GeForce RTX 3070 Laptop GPU" {
		t.Fatalf("product_name = %q", gpu.ProductName)
	}
	usage, _ := parsePercentageValue(gpu.Utilization.GPUUtil)
	if usage != 100 {
		t.Fatalf("gpu_util = %v, want 100", usage)
	}
	total, _ := parseMemoryValue(gpu.FrameBufferMemoryUsage.Total)
	if total != 8192*1024*1024 {
		t.Fatalf("memory total = %d", total)
	}
	temp, _ := parseTemperatureValue(gpu.Temperature.GPUTemp)
	if temp != 67 {
		t.Fatalf("gpu_temp = %d", temp)
	}
}

func TestSanitizeSMIOutputValidUnchanged(t *testing.T) {
	raw := []byte("<nvidia_smi_log><gpu><product_name>RTX 3070</product_name></gpu></nvidia_smi_log>")
	if got := sanitizeSMIOutput(raw); string(got) != string(raw) {
		t.Fatalf("valid input was modified: %q", got)
	}
}
