package ai

import (
	"net/http"
	"testing"
	"time"
)

func TestAChatCallThatNamesNoTimeoutUsesTheChatClientAsItIs(t *testing.T) {
	configured := &http.Client{Timeout: time.Second}
	m := &accountManager{}
	m.chat.client = configured
	if got := m.clientFor(ChatInput{}); got != configured {
		t.Fatal("a call with no timeout was given another client")
	}
}

func TestAChatCallThatNamesATimeoutGetsThatTimeoutAndLeavesTheChatClientAlone(t *testing.T) {
	transport := &http.Transport{}
	configured := &http.Client{Timeout: time.Second, Transport: transport}
	m := &accountManager{}
	m.chat.client = configured
	got := m.clientFor(ChatInput{Timeout: 10 * time.Minute})
	if got.Timeout != 10*time.Minute {
		t.Fatalf("timeout = %v, want 10m", got.Timeout)
	}
	if got.Transport != transport {
		t.Fatal("the call lost the chat client's transport")
	}
	if configured.Timeout != time.Second {
		t.Fatalf("the chat client's own timeout became %v", configured.Timeout)
	}
}

func TestTheDefaultChatClientKeepsTheTwoMinuteTimeoutForACallWithoutOne(t *testing.T) {
	m := &accountManager{}
	if got := m.clientFor(ChatInput{}).Timeout; got != chatTimeout {
		t.Fatalf("timeout = %v, want %v", got, chatTimeout)
	}
}
