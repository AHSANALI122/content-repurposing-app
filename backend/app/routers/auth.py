"""Auth routes: register, login, me."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session

from app.auth import (
    create_access_token,
    get_current_user,
    get_user_by_email,
    hash_password,
    normalize_email,
    verify_password,
)
from app.database import get_session
from app.models import User
from app.schemas import RegisterRequest, TokenResponse, UserPublic

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, session: Session = Depends(get_session)) -> TokenResponse:
    email = normalize_email(body.email)
    if get_user_by_email(session, email) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )
    user = User(email=email, hashed_password=hash_password(body.password))
    session.add(user)
    session.commit()
    session.refresh(user)
    assert user.id is not None
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenResponse)
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session),
) -> TokenResponse:
    # OAuth2 password flow: `username` carries the email.
    user = get_user_by_email(session, form.username)
    # Same generic message whether the user is missing or the password is wrong,
    # to avoid leaking which emails are registered.
    if user is None or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    assert user.id is not None
    return TokenResponse(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserPublic)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
