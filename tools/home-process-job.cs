using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class NihonHomeProcessJob {
 // Keep the sole, non-inheritable handle open until launcher process exit, including forced task stop.
 private static IntPtr job=IntPtr.Zero;
 [StructLayout(LayoutKind.Sequential)] struct BasicLimits { public long ProcessTime,JobTime; public uint Flags; public UIntPtr MinWorkingSet,MaxWorkingSet; public uint ActiveProcesses; public UIntPtr Affinity; public uint Priority,Scheduling; }
 [StructLayout(LayoutKind.Sequential)] struct IoCounters { public ulong ReadOps,WriteOps,OtherOps,ReadBytes,WriteBytes,OtherBytes; }
 [StructLayout(LayoutKind.Sequential)] struct ExtendedLimits { public BasicLimits Basic; public IoCounters Io; public UIntPtr ProcessMemory,JobMemory,PeakProcessMemory,PeakJobMemory; }
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes,string name);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr handle,int kind,ref ExtendedLimits limits,uint length);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr handle,IntPtr process);
 [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 public static void ProtectLauncher() {
  if(job!=IntPtr.Zero)return;
  IntPtr handle=CreateJobObject(IntPtr.Zero,null);if(handle==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error());
  var limits=new ExtendedLimits();limits.Basic.Flags=0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
  if(!SetInformationJobObject(handle,9,ref limits,(uint)Marshal.SizeOf(typeof(ExtendedLimits)))){int error=Marshal.GetLastWin32Error();CloseHandle(handle);throw new Win32Exception(error);}
  // Join before spawning node: all children inherit the job, so there is no start/assign race.
  if(!AssignProcessToJobObject(handle,GetCurrentProcess())){int error=Marshal.GetLastWin32Error();CloseHandle(handle);throw new Win32Exception(error);}
  job=handle;
 }
}
